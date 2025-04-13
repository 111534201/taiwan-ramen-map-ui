// src/components/AddReviewForm.jsx
import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../services/api';
// import { useAuth } from '../hooks/useAuth'; // 這個組件內不需要 useAuth，因為調用它的父組件應已確保登入
import './AddReviewForm.css'; // 引入樣式

/**
 * 添加/編輯評論/回覆的表單組件
 */
const AddReviewForm = ({
  shopId,
  isReplyMode = false,
  parentReviewId = null,
  reviewToEdit = null, // 傳入要編輯的 review 對象
  onReviewAdded, // 新增成功回調
  onReviewUpdated, // 更新成功回調
  onCancelEdit // 取消編輯/回覆回調
}) => {
  const isEditMode = !!reviewToEdit; // 判斷是否為編輯模式

  // --- 表單狀態 ---
  const [rating, setRating] = useState(0); // 評分 (1-5)，0 表示未選
  const [content, setContent] = useState(''); // 評論內容
  const [photos, setPhotos] = useState([]); // File 對象列表 (僅新增)
  const [photoPreviews, setPhotoPreviews] = useState([]); // 預覽 URL 列表 (僅新增)

  // --- 其他狀態 ---
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  // --- 效果：當處於編輯模式時，用 reviewToEdit 初始化表單 ---
  useEffect(() => {
    if (isEditMode && reviewToEdit) {
      setRating(reviewToEdit.rating || 0); // 設置初始評分
      setContent(reviewToEdit.content || ''); // 設置初始內容
      setPhotos([]); // 清空文件選擇 (編輯模式不處理文件)
      setPhotoPreviews([]);
      setError('');
    } else {
      // 切換回非編輯模式時重置表單 (可選)
      // setRating(0);
      // setContent('');
      // setPhotos([]);
      // setPhotoPreviews([]);
      // setError('');
    }
  }, [reviewToEdit, isEditMode]); // 依賴 reviewToEdit 和 isEditMode

  // --- 清理照片預覽內存 ---
   useEffect(() => {
       return () => {
           photoPreviews.forEach(url => URL.revokeObjectURL(url));
       };
   }, [photoPreviews]);

  // --- 處理評分點擊 ---
  const handleRatingChange = (newRating) => {
     // 只有在非回覆模式 (且非編輯回覆) 時才允許修改評分
     if (!isReplyMode || (isEditMode && reviewToEdit?.parentReviewId === null)) {
          setRating(newRating);
     }
  };

  // --- 處理文件選擇 ---
  const handleFileChange = (event) => {
      if (isEditMode) return; // 編輯模式禁用文件選擇
      const files = Array.from(event.target.files);
      if (!files || files.length === 0) return;

      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      if(imageFiles.length !== files.length) {
          setError('只能上傳圖片文件');
          if (fileInputRef.current) fileInputRef.current.value = ""; // 清空選擇
          setPhotos([]); setPhotoPreviews([]); return;
      }
      // 可在此處添加文件大小/數量限制
      // ...

      setPhotos(imageFiles); // 存儲文件對象

      // 生成預覽 URL
      const currentPreviews = imageFiles.map(file => URL.createObjectURL(file));
      // 先清理之前的預覽內存
      photoPreviews.forEach(url => URL.revokeObjectURL(url));
      setPhotoPreviews(currentPreviews);
      setError('');
  };

  // --- 處理表單提交 ---
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    // 基本驗證
    if (!isEditMode && !isReplyMode && rating === 0) { setError('請為店家評分'); return; }
    // if (!content && photos.length === 0 && !isEditMode) { setError('請填寫評論內容或上傳照片'); return; }

    setIsSubmitting(true);

    try {
      if (isEditMode) {
        // --- 編輯邏輯 ---
        const updateData = {
          content: content,
          // 只有頂級評論才包含評分
          rating: reviewToEdit.parentReviewId === null ? (rating > 0 ? rating : undefined) : undefined
        };
        // 移除值為 undefined 的字段 (如果後端不接受 null)
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        console.log(`[AddReviewForm] Updating review ${reviewToEdit.id}`, updateData);
        await apiClient.put(`/reviews/${reviewToEdit.id}`, updateData);
        console.log('[AddReviewForm] Review update successful.');
        if (onReviewUpdated) onReviewUpdated(); // 調用成功回調

      } else {
        // --- 新增邏輯 ---
        const formData = new FormData();
        const reviewData = {
          content: content,
          // 只有頂級評論傳遞評分
          rating: !isReplyMode && rating > 0 ? rating : undefined,
          parentReviewId: isReplyMode ? parentReviewId : undefined,
        };
        Object.keys(reviewData).forEach(key => reviewData[key] === undefined && delete reviewData[key]);

        const reviewDataBlob = new Blob([JSON.stringify(reviewData)], { type: 'application/json' });
        formData.append('reviewData', reviewDataBlob);

        if (photos.length > 0) {
          photos.forEach(photo => formData.append('photos', photo));
        }

        console.log(`[AddReviewForm] Creating review/reply for shop ${shopId}`);
        await apiClient.post(`/reviews/shop/${shopId}`, formData);
        console.log('[AddReviewForm] Review/Reply creation successful.');
        if (onReviewAdded) onReviewAdded(); // 調用成功回調
        // 清空表單
        setRating(0); setContent(''); setPhotos([]); setPhotoPreviews([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("[AddReviewForm] Submit failed:", error?.data?.message || error?.message || error);
      setError(error?.data?.message || error?.message || '提交時發生錯誤');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 渲染星星評分組件 ---
  const renderRatingStars = () => {
     // 編輯回覆 或 新增回覆 模式下不顯示星星
     if ((isEditMode && reviewToEdit?.parentReviewId !== null) || (!isEditMode && isReplyMode)) {
         return null;
     }
    return (
      <div className="rating-input form-group"> {/* 添加 form-group */}
         <label>評分 {isReplyMode ? '(回覆無需評分)' : '*'}</label> {/* 提示 */}
        <div> {/* 包裹星星和文字 */}
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={`star selectable-star ${star <= rating ? 'selected' : ''}`}
              onClick={() => handleRatingChange(star)}
            >
              ★
            </span>
          ))}
          <span className="rating-value">{rating > 0 ? `${rating} 星` : '(請選擇)'}</span>
        </div>
      </div>
    );
  };

  // --- 渲染表單 ---
  return (
    <div className={`add-review-form-container ${isEditMode ? 'edit-mode' : ''} ${isReplyMode ? 'reply-mode' : ''}`}>
      <form onSubmit={handleSubmit} className="add-review-form">
        <h4>{isEditMode ? '編輯評論' : (isReplyMode ? '發表回覆' : '發表評論')}</h4>
        {error && <div className="error-message">{error}</div>}

        {renderRatingStars()} {/* 渲染星星 */}

        <div className="form-group">
          <label htmlFor={`review-content-${parentReviewId || shopId}`}>{isReplyMode ? '回覆內容' : '評論內容'}</label>
          <textarea
            id={`review-content-${parentReviewId || shopId}`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows="4"
            placeholder={isReplyMode ? '輸入您的回覆...' : '分享您的用餐體驗...'}
            disabled={isSubmitting}
          />
        </div>

        {/* 文件上傳 (僅新增模式) */}
        {!isEditMode && (
          <div className="form-group">
            <label htmlFor={`review-photos-${parentReviewId || shopId}`}>上傳照片 (選填)</label>
            <input
                type="file"
                id={`review-photos-${parentReviewId || shopId}`}
                multiple
                accept="image/*"
                onChange={handleFileChange}
                disabled={isSubmitting}
                ref={fileInputRef}
            />
            {/* 照片預覽 */}
            {photoPreviews.length > 0 && (
                 <div className="photo-previews review-photo-previews">
                     {photoPreviews.map((previewUrl, index) => (
                         <img key={index} src={previewUrl} alt={`預覽 ${index + 1}`} className="photo-preview-item" />
                     ))}
                 </div>
             )}
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="submit-button" disabled={isSubmitting}>
            {isSubmitting ? '提交中...' : (isEditMode ? '更新評論' : '送出')}
          </button>
          {/* 取消按鈕 */}
          {(isEditMode || isReplyMode) && typeof onCancelEdit === 'function' && (
            <button type="button" onClick={onCancelEdit} className="cancel-button" disabled={isSubmitting}>
              取消
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default AddReviewForm;