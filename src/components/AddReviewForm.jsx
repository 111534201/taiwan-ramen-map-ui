// src/components/AddReviewForm.jsx
import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../services/api';
import useAuth from '../hooks/useAuth'; // 用於檢查登入狀態和獲取用戶 ID
import './AddReviewForm.css'; // 引入表單樣式
import { FaStar } from 'react-icons/fa'; // 引入星星圖標

// --- 輔助函數：構建完整的圖片 URL (如果需要顯示 existingMedia) ---
const buildMediaUrl = (relativePath) => {
    if (!relativePath) return '/placeholder-image.png';
    if (relativePath.startsWith('http')) return relativePath;
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
    const uploadPath = '/uploads';
    const cleanRelativePath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    return `${baseUrl}${uploadPath}/${cleanRelativePath}`;
};
// --- ---

const AddReviewForm = ({
    shopId,                  // 當前店家的 ID
    reviewToEdit = null,     // 如果是編輯模式，傳入要編輯的 review 對象
    isReplyMode = false,     // 是否為回覆模式？
    parentReviewId = null,   // 如果是回覆模式，父評論的 ID
    onReviewAdded,           // 新增成功後的回調函數 (接收新 review DTO)
    onReviewUpdated,         // 更新成功後的回調函數 (接收更新後的 review DTO)
    onCancelEdit             // 取消編輯/回覆的回調函數
}) => {
    const { isAuthenticated, user } = useAuth(); // 獲取認證狀態和用戶信息

    // --- State ---
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState('');
    const [photos, setPhotos] = useState([]);
    const [photoPreviews, setPhotoPreviews] = useState([]);
    const [existingMedia, setExistingMedia] = useState([]);
    const [mediaToDelete, setMediaToDelete] = useState([]);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const fileInputRef = useRef(null);

    // --- 效果：編輯模式下初始化表單 ---
    useEffect(() => {
        if (reviewToEdit) {
            setRating(reviewToEdit.rating || 0);
            setComment(reviewToEdit.content || ''); // 使用 content
            setPhotos([]); setPhotoPreviews([]); setMediaToDelete([]);
            setExistingMedia(Array.isArray(reviewToEdit.media) ? reviewToEdit.media : []);
            console.log("[AddReviewForm] Editing mode initialized. Initial content:", reviewToEdit.content);
        } else {
            setRating(0); setComment(''); setPhotos([]); setPhotoPreviews([]); setMediaToDelete([]); setExistingMedia([]);
            console.log(`[AddReviewForm] Initialized for ${isReplyMode ? 'reply' : 'new review'}`);
        }
        setError('');
    }, [reviewToEdit, isReplyMode]);

    // --- 評分處理 ---
    const handleRatingClick = (value) => { if (isLoading) return; if (isReplyMode || (reviewToEdit && reviewToEdit.parentReviewId)) { console.warn("[AddReviewForm] Cannot rate a reply."); return; } setRating(value); };
    const handleRatingHover = (value) => { if (isLoading || isReplyMode || (reviewToEdit && reviewToEdit.parentReviewId)) return; setHoverRating(value); };
    const handleCommentChange = (event) => { setComment(event.target.value); };

    // --- 圖片處理 ---
    const handlePhotoChange = (event) => {
        if (event.target.files) {
            const newFiles = Array.from(event.target.files);
            const validFiles = newFiles.filter(file => file.type.startsWith('image/'));
            if (validFiles.length !== newFiles.length) { setError('只能上傳圖片文件。'); } else { setError(''); }
            const maxPhotos = 5; const totalMediaCount = existingMedia.length - mediaToDelete.length + photos.length + validFiles.length;
            if (totalMediaCount > maxPhotos) {
                setError(`最多只能上傳 ${maxPhotos} 張照片。`);
                const allowedNewFiles = validFiles.slice(0, maxPhotos - (existingMedia.length - mediaToDelete.length + photos.length));
                setPhotos(prev => [...prev, ...allowedNewFiles]);
                const previews = allowedNewFiles.map(file => URL.createObjectURL(file));
                setPhotoPreviews(prev => [...prev, ...previews]);
            } else {
                setPhotos(prev => [...prev, ...validFiles]);
                const previews = validFiles.map(file => URL.createObjectURL(file));
                setPhotoPreviews(prev => [...prev, ...previews]);
            }
            event.target.value = null;
        }
    };
    const handleRemoveNewPhoto = (indexToRemove) => { URL.revokeObjectURL(photoPreviews[indexToRemove]); setPhotos(prev => prev.filter((_, index) => index !== indexToRemove)); setPhotoPreviews(prev => prev.filter((_, index) => index !== indexToRemove)); };
    const handleToggleDeleteExistingMedia = (mediaId) => { setMediaToDelete(prev => prev.includes(mediaId) ? prev.filter(id => id !== mediaId) : [...prev, mediaId]); };
    useEffect(() => { return () => { photoPreviews.forEach(url => URL.revokeObjectURL(url)); }; }, [photoPreviews]);

    // --- 提交表單 ---
    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        if (!isReplyMode && !(reviewToEdit && reviewToEdit.parentReviewId) && rating === 0) { setError('請選擇評分。'); return; }
        if (!comment.trim()) { setError('請填寫內容。'); return; }
        if (!isAuthenticated || !user) { setError('請先登入。'); return; }
        setIsLoading(true);

        try {
            let response;
            if (reviewToEdit) {
                // --- 更新評論 ---
                const updateData = {
                    content: comment,
                    // 只有頂級評論才需要 rating，如果是回覆則設為 null
                    rating: (reviewToEdit.parentReviewId) ? null : rating,
                };
                console.log(`[AddReviewForm] Updating review ${reviewToEdit.id} with data:`, updateData);
                response = await apiClient.put(`/reviews/${reviewToEdit.id}`, updateData); // 發送 JSON

                if (mediaToDelete.length > 0) {
                    console.log(`[AddReviewForm] Deleting existing media:`, mediaToDelete);
                    for (const mediaIdToDelete of mediaToDelete) {
                        try { await apiClient.delete(`/reviews/${reviewToEdit.id}/media/${mediaIdToDelete}`); console.log(`Deleted media ${mediaIdToDelete}`); }
                        catch (deleteError) { console.error(`Failed to delete media ${mediaIdToDelete}:`, deleteError); }
                    }
                }
                if (photos.length > 0) { console.warn("更新評論時上傳新圖片功能未實現或需要單獨接口"); }

                if (response.data?.success) {
                    console.log("[AddReviewForm] Update successful, calling onReviewUpdated with:", response.data.data);
                    if (typeof onReviewUpdated === 'function') onReviewUpdated(response.data.data);
                } else { throw new Error(response.data?.message || '更新失敗'); }

            } else {
                // --- 新增評論或回覆 ---
                const reviewDataPayload = { rating: isReplyMode ? null : rating, content: comment, parentReviewId: parentReviewId || null };
                const formData = new FormData();
                formData.append('reviewData', new Blob([JSON.stringify(reviewDataPayload)], { type: 'application/json' }));
                photos.forEach(p => formData.append('photos', p));

                console.log('[AddReviewForm] Creating new review/reply for shop:', shopId);
                response = await apiClient.post(`/reviews/shop/${shopId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

                if (response.data?.success) {
                    console.log("[AddReviewForm] Create successful, calling onReviewAdded with:", response.data.data);
                    if (typeof onReviewAdded === 'function') onReviewAdded(response.data.data);
                } else { throw new Error(response.data?.message || '提交失敗'); }
            }
            // 成功後可以考慮清空表單，但通常由父組件的回調處理
            // setRating(0); setComment(''); setPhotos([]); setPhotoPreviews([]); setMediaToDelete([]); setExistingMedia([]); setError('');

        } catch (err) {
            console.error("[AddReviewForm] Submit error:", err);
            // 嘗試提取後端返回的具體錯誤信息
            const backendErrorMsg = err?.data?.message || err?.response?.data?.message || err?.message || '提交時發生錯誤';
            setError(backendErrorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    // --- 取消按鈕處理 ---
    const handleCancel = () => {
        if (typeof onCancelEdit === 'function') {
            onCancelEdit();
        } else {
            setRating(0); setComment(''); setPhotos([]); setPhotoPreviews([]); setError('');
        }
    };

    // --- 渲染 ---
    if (!isAuthenticated && !isAuthLoading) { return <p className="login-prompt">請先登入才能發表或編輯評論。</p>; }

    const formTitle = reviewToEdit ? (isReplyMode || reviewToEdit.parentReviewId ? '編輯回覆' : '編輯評論') : (isReplyMode ? '發表回覆' : '發表評論');
    const submitButtonText = reviewToEdit ? '更新' : '送出';

    return (
        <div className="add-review-form-container">
            <h3>{formTitle}</h3>
            <form onSubmit={handleSubmit} className="review-form">
                {error && <div className="error-message">{error}</div>}

                {/* 評分區域 */}
                {!isReplyMode && (!reviewToEdit || !reviewToEdit.parentReviewId) && (
                    <div className="form-group rating-group">
                        <label>評分 <span className="required">*</span></label>
                        <div className="stars-input" onMouseLeave={() => handleRatingHover(0)}>
                            {[...Array(5)].map((_, index) => {
                                const ratingValue = index + 1;
                                return ( <FaStar key={ratingValue} className="star-icon" color={(hoverRating || rating) >= ratingValue ? "#ffc107" : "#e4e5e9"} size={25} onClick={() => handleRatingClick(ratingValue)} onMouseEnter={() => handleRatingHover(ratingValue)} style={{ cursor: isLoading ? 'default' : 'pointer', marginRight: '5px' }} /> );
                            })}
                             <span className="rating-label"> {rating > 0 ? `(${rating} 星)` : '(請選擇)'} </span>
                        </div>
                    </div>
                )}

                {/* 評論內容 */}
                <div className="form-group">
                    <label htmlFor={`comment-${parentReviewId || shopId}`}> {isReplyMode ? '回覆內容' : '評論內容'} <span className="required">*</span> </label>
                    <textarea id={`comment-${parentReviewId || shopId}`} value={comment} onChange={handleCommentChange} placeholder={isReplyMode ? '輸入您的回覆...' : '分享您的用餐體驗...'} rows={4} required disabled={isLoading} />
                </div>

                {/* 圖片上傳 (僅新增/編輯頂級評論) */}
                 {(!isReplyMode || (reviewToEdit && !reviewToEdit.parentReviewId)) && (
                     <div className="form-group">
                         <label>上傳照片 (選填，最多 5 張)</label>
                         {existingMedia.length > 0 && ( <div className="existing-media-preview"> <p>目前照片:</p> {existingMedia.map(media => ( <div key={media.id} className={`media-item ${mediaToDelete.includes(media.id) ? 'marked-for-delete' : ''}`}> <img src={buildMediaUrl(media.url)} alt="已上傳照片" /> <button type="button" onClick={() => handleToggleDeleteExistingMedia(media.id)}> {mediaToDelete.includes(media.id) ? '取消刪除' : '刪除'} </button> </div> ))} </div> )}
                         {photoPreviews.length > 0 && ( <div className="new-media-preview"> <p>新上傳預覽:</p> {photoPreviews.map((previewUrl, index) => ( <div key={index} className="media-item"> <img src={previewUrl} alt={`預覽 ${index + 1}`} /> <button type="button" onClick={() => handleRemoveNewPhoto(index)} disabled={isLoading}>移除</button> </div> ))} </div> )}
                         <input type="file" accept="image/*" multiple onChange={handlePhotoChange} ref={fileInputRef} style={{ display: 'none' }} disabled={isLoading} />
                         <button type="button" onClick={() => fileInputRef.current?.click()} className="upload-button" disabled={isLoading || (existingMedia.length - mediaToDelete.length + photos.length >= 5)} > 選擇檔案 </button>
                         <span className="file-info"> (已選 {photos.length} 張新照片{existingMedia.length > 0 && `, 保留 ${existingMedia.length - mediaToDelete.length} 張舊照片`}) </span>
                     </div>
                 )}

                {/* 操作按鈕 */}
                <div className="form-actions">
                    <button type="submit" className="submit-button" disabled={isLoading}> {isLoading ? '提交中...' : submitButtonText} </button>
                    {(reviewToEdit || isReplyMode) && typeof onCancelEdit === 'function' && ( <button type="button" onClick={handleCancel} className="cancel-button" disabled={isLoading}> 取消 </button> )}
                </div>
            </form>
        </div>
    );
};

export default AddReviewForm;