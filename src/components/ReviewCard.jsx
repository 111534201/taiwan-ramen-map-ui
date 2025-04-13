// src/components/ReviewCard.jsx
import React from 'react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { renderStars } from '../utils/uiUtils';
import './ReviewCard.css';

const formatDateTime = (dateTimeString) => { /* ... (保持不變) ... */ };

const ReviewCard = ({
    review,
    isReply,
    shopOwnerId,
    currentUserId, // <--- 需要這個
    isShopOwnerViewing,
    onDelete,
    onEdit,         // <--- 需要這個
    onReply,
    onLoadReplies,
    isExpanded,
    replyCount = 0,
    isLoadingReplies = false
}) => {

    if (!review || !review.user) { /* ... */ }

    // --- 權限檢查 (確保 ID 比較時類型一致) ---
    const isCurrentUserAuthor = !!currentUserId && String(review.user.id) === String(currentUserId); // <--- 修改：轉成字串比較
    const canEditDelete = isCurrentUserAuthor; // 簡化變量名
    const canReply = isShopOwnerViewing && !isReply && typeof onReply === 'function';

    // --- 顯示邏輯 (保持不變) ---
    const isShopOwnerComment = !!shopOwnerId && String(review.user.id) === String(shopOwnerId); // <--- 修改：轉成字串比較
    const userName = review.user.username || '匿名用戶';
    const createdAt = review.createdAt ? new Date(review.createdAt) : null;
    const updatedAt = review.updatedAt ? new Date(review.updatedAt) : null;
    const wasEdited = createdAt && updatedAt && (updatedAt.getTime() - createdAt.getTime() > 1000 * 60);

    // --- 處理編輯按鈕點擊 ---
    const handleEditClick = () => {
        console.log(`[ReviewCard] Edit button clicked for review ID: ${review.id}. Calling onEdit.`); // 添加日誌
        if (typeof onEdit === 'function') {
            onEdit(review); // 確認調用了傳入的 onEdit 函數
        } else {
            console.error(`[ReviewCard] onEdit prop is not a function for review ID: ${review.id}`);
        }
    };

    // --- 處理刪除按鈕點擊 ---
     const handleDeleteClick = () => {
         console.log(`[ReviewCard] Delete button clicked for review ID: ${review.id}. Calling onDelete.`);
         if (typeof onDelete === 'function') {
             onDelete(review.id);
         } else {
            console.error(`[ReviewCard] onDelete prop is not a function for review ID: ${review.id}`);
         }
     };

     // --- 處理回覆按鈕點擊 ---
      const handleReplyClick = () => {
          console.log(`[ReviewCard] Reply button clicked for review ID: ${review.id}. Calling onReply.`);
          if (typeof onReply === 'function') {
              onReply(review.id);
          } else {
             console.error(`[ReviewCard] onReply prop is not a function for review ID: ${review.id}`);
          }
      };


    return (
        <div className={`review-card ${isReply ? 'reply-card' : ''}`}>
            {/* ... Header, Rating, Body ... */}
             <div className="review-header"> <span className="review-user">{userName}{isShopOwnerComment && <span className="shop-owner-tag">(店家)</span>}</span> <span className="review-meta">{formatDateTime(review.updatedAt || review.createdAt)}{wasEdited && <span className="edited-tag">(已編輯)</span>}</span> </div>
             {!isReply && review.rating !== null && review.rating !== undefined && ( <div className="review-rating">{renderStars(review.rating)}</div> )}
             <div className="review-body"><pre className="review-comment">{review.comment || ''}</pre></div>

            <div className="review-actions">
                {/* --- 編輯按鈕 --- */}
                {/* 條件：是作者 & 提供了 onEdit 函數 */}
                {canEditDelete && typeof onEdit === 'function' && (
                    // *** 使用 handleEditClick ***
                    <button onClick={handleEditClick} className="action-button edit-button">
                        編輯
                    </button>
                )}
                {/* --- 刪除按鈕 --- */}
                {canEditDelete && typeof onDelete === 'function' && (
                    // *** 使用 handleDeleteClick ***
                    <button onClick={handleDeleteClick} className="action-button delete-button">
                        刪除
                    </button>
                )}
                {/* --- 店家回覆按鈕 --- */}
                {canReply && (
                     // *** 使用 handleReplyClick ***
                    <button onClick={handleReplyClick} className="action-button reply-button">
                        回覆
                    </button>
                )}

                {/* --- 回覆相關按鈕/指示器 (保持不變) --- */}
                {!isReply && ( <> {/* ... */} </> )}
            </div>
        </div>
    );
};

export default ReviewCard;