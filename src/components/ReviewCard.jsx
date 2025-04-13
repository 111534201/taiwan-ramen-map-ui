// src/components/ReviewCard.jsx
import React from 'react';
import useAuth from '../hooks/useAuth';      // 導入 useAuth hook
import { renderStars } from '../utils/uiUtils'; // 導入星星渲染函數 (確保路徑正確)
import { formatDistanceToNow } from 'date-fns'; // 導入日期格式化函數
import { zhTW } from 'date-fns/locale';         // 導入中文語系
import { Role } from '../constants/roles';      // 導入角色常量 (確保路徑正確)
import './ReviewCard.css';                     // 引入樣式

/**
 * 評論卡片組件，用於顯示單條評論或回覆。
 * @param {object} props
 * @param {object} props.review - 評論或回覆的數據對象 (ReviewDTO)
 * @param {boolean} [props.isReply=false] - 是否為回覆樣式
 * @param {number|null} props.shopOwnerId - 當前頁面店家的擁有者 ID
 * @param {function} props.onDelete - 刪除回調 (接收 review.id)
 * @param {function} props.onEdit - 編輯回調 (接收 review 對象)
 * @param {function|null} props.onReply - 回覆按鈕回調 (接收 review.id), 僅頂級評論有
 * @param {function} [props.onLoadReplies] - 加載/收起回覆按鈕回調 (接收 review.id), 僅頂級評論有
 * @param {boolean} [props.isExpanded=false] - 回覆是否已展開
 * @param {number} [props.replyCount=0] - 回覆數量
 */
const ReviewCard = ({
  review,
  isReply = false,
  shopOwnerId,
  onDelete,
  onEdit,
  onReply,
  onLoadReplies,
  isExpanded = false,
  replyCount = 0
}) => {
  const { user, isAuthenticated } = useAuth(); // 獲取當前登入用戶和認證狀態

  // --- 基本檢查 ---
  // 如果 review 或 review.user 無效，渲染錯誤提示或 null
  if (!review || !review.user) {
       console.warn("ReviewCard: 無效的 review 或 review.user 數據", review);
       // 可以返回一個更友好的佔位符
       return <div className="review-card error-placeholder">無法加載評論信息。</div>;
   }

  // --- 權限判斷 ---
  const currentUserId = user?.id;
  const isAdmin = user?.roles?.includes(Role.ROLE_ADMIN);
  const isAuthor = isAuthenticated && review.user.id === currentUserId; // 是否為評論/回覆的作者
  // 是否為當前頁面店家的主人 (用於判斷是否能回覆頂級評論)
  const isShopOwnerViewing = isAuthenticated && user?.roles?.includes(Role.ROLE_SHOP_OWNER) && shopOwnerId === currentUserId;
  // 這條回覆是否為店家所寫 (用於顯示店家標籤)
  const isOwnerReply = isReply && review.user.id === shopOwnerId;

  const canEdit = isAuthor; // 只有作者能編輯
  const canDelete = isAuthor || isAdmin; // 作者或管理員能刪除
  const canReply = !isReply && isAuthenticated && typeof onReply === 'function' && !isShopOwnerViewing; // 登入用戶(非店家本人)可以回覆頂級評論
  const canLoadReplies = !isReply && typeof onLoadReplies === 'function' && replyCount > 0; // 頂級評論且有回覆數才能查看

  // --- 時間格式化 ---
  const timeAgo = review.createdAt
    ? formatDistanceToNow(new Date(review.createdAt), { addSuffix: true, locale: zhTW })
    : '時間未知';
   const updatedTimeAgo = (review.updatedAt && review.updatedAt !== review.createdAt)
    ? `(編輯於 ${formatDistanceToNow(new Date(review.updatedAt), { addSuffix: true, locale: zhTW })})`
    : '';

  // --- 渲染媒體 (照片) ---
  // 輔助函數：構建完整的媒體 URL (與 ShopDetailPage 相同，建議提取)
  const buildMediaUrl = (relativePath) => {
      if (!relativePath) return null;
      if (relativePath.startsWith('http')) return relativePath;
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
      const uploadPath = '/uploads';
      const cleanRelativePath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
      return `${baseUrl}${uploadPath}/${cleanRelativePath}`;
  };

  const renderMedia = () => {
    if (!Array.isArray(review.media) || review.media.length === 0) {
      return null;
    }
    return (
      <div className="review-media-list">
        {review.media.map(media => {
           const fullUrl = buildMediaUrl(media?.url); // 生成完整 URL
           return fullUrl ? (
            <img
              key={media.id}
              src={fullUrl} // 使用完整 URL
              alt={`評論照片 ${media.id}`}
              className="review-media-item"
              loading="lazy"
              onClick={() => window.open(fullUrl, '_blank')} // 點擊放大
              onError={(e) => { e.target.style.display = 'none'; }} // 加載失敗則隱藏
            />
          ) : null;
        })}
      </div>
    );
  };

  // --- 卡片樣式 ---
  const cardClassName = `review-card ${isReply ? 'reply' : ''} ${isOwnerReply ? 'owner-reply' : ''}`;

  // --- 渲染組件 ---
  return (
    <div className={cardClassName} data-review-id={review.id}>
      {/* 評論頭部：作者、評分(頂級)、時間 */}
      <div className="review-card-header">
        <span className="review-author">
          {/* 可以添加用戶頭像 */}
          {review.user.username}
          {/* 如果是店家回覆，顯示標籤 */}
          {isOwnerReply && <span className="owner-badge">(店家)</span>}
        </span>
        {/* 只在頂級評論顯示評分 */}
        {!isReply && review.rating != null && (
          <span className="review-rating stars">{renderStars(review.rating)}</span>
        )}
        {/* 評論時間 */}
        <span className="review-time" title={review.createdAt ? new Date(review.createdAt).toLocaleString() : ''}>
            {timeAgo} {updatedTimeAgo && <span className="updated-time">{updatedTimeAgo}</span>}
        </span>
      </div>

      {/* 評論內容 */}
      {review.content && (
         <p className="review-content">{review.content}</p>
      )}

      {/* 評論照片 */}
      {renderMedia()}

      {/* 操作按鈕 */}
      <div className="review-card-actions">
         {/* 回覆按鈕 */}
        {canReply && (
            <button onClick={() => onReply(review.id)} className="action-button reply-button">
                回覆
            </button>
         )}
         {/* 查看/收起回覆按鈕 */}
         {canLoadReplies && (
              <button onClick={() => onLoadReplies(review.id)} className="action-button toggle-replies-button">
                  {isExpanded ? '收起回覆' : `查看 ${replyCount} 則回覆`}
              </button>
          )}
        {/* 編輯按鈕 */}
        {canEdit && (
          <button onClick={() => onEdit(review)} className="action-button edit-button">
            編輯
          </button>
        )}
        {/* 刪除按鈕 */}
        {canDelete && (
          <button onClick={() => onDelete(review.id)} className="action-button delete-button">
            刪除
          </button>
        )}
      </div>
    </div>
  );
};

// --- PropTypes (可選但推薦) ---
import PropTypes from 'prop-types';
ReviewCard.propTypes = {
    review: PropTypes.shape({
        id: PropTypes.number.isRequired,
        rating: PropTypes.number,
        content: PropTypes.string,
        user: PropTypes.shape({
            id: PropTypes.number.isRequired,
            username: PropTypes.string.isRequired,
        }).isRequired,
        shopId: PropTypes.number, // 可選，取決於 DTO 是否包含
        parentReviewId: PropTypes.number,
        replyCount: PropTypes.number,
        media: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.number.isRequired,
            url: PropTypes.string, // URL or relative path
            type: PropTypes.string,
        })),
        createdAt: PropTypes.string,
        updatedAt: PropTypes.string,
    }).isRequired,
    isReply: PropTypes.bool,
    shopOwnerId: PropTypes.number,
    onDelete: PropTypes.func.isRequired, // 假設刪除總是需要的
    onEdit: PropTypes.func, // 編輯是可選的 (例如回覆不能再編輯)
    onReply: PropTypes.func, // 回覆是可選的
    onLoadReplies: PropTypes.func, // 加載回覆是可選的
    isExpanded: PropTypes.bool,
    replyCount: PropTypes.number,
};


export default ReviewCard;