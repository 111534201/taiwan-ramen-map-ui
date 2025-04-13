// src/components/ShopForm.jsx
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import apiClient from '../services/api'; // 可能需要 apiClient 來刪除媒體
import { useNavigate } from 'react-router-dom'; // 可能需要跳轉
import './ShopForm.css'; // 確保引入樣式

// 輔助函數：構建媒體 URL (如果需要顯示現有媒體的預覽)
const buildMediaUrl = (relativePath) => {
    if (!relativePath) return null;
    if (relativePath.startsWith('http')) return relativePath;
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
    const uploadPath = '/uploads';
    const cleanRelativePath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    return `${baseUrl}${uploadPath}/${cleanRelativePath}`;
};


const ShopForm = ({ isEditMode, initialData = null, onSubmit, isSubmitting, error: externalError }) => {
  const navigate = useNavigate(); // 用於取消按鈕等

  // --- 表單字段狀態 ---
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [description, setDescription] = useState('');

  // --- 媒體管理狀態 (編輯模式) ---
  const [existingMedia, setExistingMedia] = useState([]); // ShopMediaDTO[]
  const [deletedMediaIds, setDeletedMediaIds] = useState(new Set()); // Set<number>

  // --- 新文件上傳狀態 ---
  const [newFiles, setNewFiles] = useState([]); // File[]
  const [newFilePreviews, setNewFilePreviews] = useState([]); // string[]
  const fileInputRef = useRef(null);

  // --- 內部錯誤狀態 ---
  const [formError, setFormError] = useState('');

  // --- 效果：初始化表單 (編輯模式) ---
  useEffect(() => {
    setFormError('');
    setDeletedMediaIds(new Set());
    setNewFiles([]);
    setNewFilePreviews([]); // 清理舊預覽

    if (isEditMode && initialData) {
      console.log("[ShopForm] Initializing with edit data:", initialData);
      setName(initialData.name || '');
      setAddress(initialData.address || '');
      setPhone(initialData.phone || '');
      setOpeningHours(initialData.openingHours || '');
      setDescription(initialData.description || '');
      setExistingMedia(Array.isArray(initialData.media) ? initialData.media : []);
    } else {
      // 清空表單 (確保從編輯切換到新增時清空)
      setName(''); setAddress(''); setPhone(''); setOpeningHours(''); setDescription('');
      setExistingMedia([]);
    }
  }, [initialData, isEditMode]);

   // --- 效果：清理新文件預覽 URL ---
   useEffect(() => {
       return () => {
           newFilePreviews.forEach(url => URL.revokeObjectURL(url));
       };
   }, [newFilePreviews]);

  // --- 處理新文件選擇 ---
  const handleFileChange = (event) => {
      const files = Array.from(event.target.files);
       if (!files || files.length === 0) return;

       const allowedFiles = files.filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'));
       if (allowedFiles.length !== files.length) {
           setFormError('只能上傳圖片或影片文件');
           if (fileInputRef.current) fileInputRef.current.value = "";
           setNewFiles([]); setNewFilePreviews([]); return;
       }
       // 可在此添加文件總數量或大小限制
        const currentTotalMedia = existingMedia.length - deletedMediaIds.size + allowedFiles.length;
        if (currentTotalMedia > 10) { // 示例：限制最多 10 個媒體
            setFormError('店家媒體總數不能超過 10 個');
            if (fileInputRef.current) fileInputRef.current.value = "";
            setNewFiles([]); setNewFilePreviews([]); return;
        }


      setNewFiles(allowedFiles);

      // 生成預覽
      const currentPreviews = allowedFiles.map(file => URL.createObjectURL(file));
      // 清理舊的預覽 URL 內存
      newFilePreviews.forEach(url => URL.revokeObjectURL(url));
      setNewFilePreviews(currentPreviews);
      setFormError('');
  };

  // --- 標記/取消標記刪除現有媒體 ---
  const toggleDeleteExistingMedia = (mediaId) => {
       setDeletedMediaIds(prev => {
           const newSet = new Set(prev);
           if (newSet.has(mediaId)) {
               newSet.delete(mediaId); // 如果已標記，則取消
           } else {
               newSet.add(mediaId); // 否則標記
           }
           return newSet;
       });
   };

  // --- 處理表單提交 ---
  const handleSubmit = (event) => {
    event.preventDefault();
    setFormError('');

    if (!name || !address) { setFormError('店家名稱和地址為必填項'); return; }

    // 調用父組件的 onSubmit 回調，傳遞所有需要的數據
    onSubmit({
      shopFormData: { name, address, phone, openingHours, description },
      newFiles: newFiles, // 傳遞 File 對象數組
      deletedMediaIds: Array.from(deletedMediaIds) // 將 Set 轉為數組
    });
  };

  // --- 渲染 ---
  return (
    <form onSubmit={handleSubmit} className="shop-form">
      <h2>{isEditMode ? '編輯店家資訊' : (initialData ? '編輯店家資訊' : '新增店家資訊')}</h2> {/* 根據模式顯示標題 */}

      {/* 顯示錯誤信息 */}
      {(externalError || formError) && (
        <div className="error-message">{externalError || formError}</div>
      )}

      {/* 基本信息表單區域 */}
      <fieldset disabled={isSubmitting}>
        <legend>基本資訊</legend>
        <div className="form-group">
          <label htmlFor="shop-name">店家名稱 *</label>
          <input type="text" id="shop-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength="100" />
        </div>
        <div className="form-group">
          <label htmlFor="shop-address">店家地址 *</label>
          <input type="text" id="shop-address" value={address} onChange={(e) => setAddress(e.target.value)} required maxLength="512" />
          <small>請輸入完整、可識別的地址。</small>
        </div>
        <div className="form-group">
          <label htmlFor="shop-phone">電話 (選填)</label>
          <input type="tel" id="shop-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength="30" /> {/* 增加長度 */}
        </div>
         <div className="form-group">
          <label htmlFor="shop-openingHours">營業時間描述 (選填)</label>
          <textarea id="shop-openingHours" value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} rows="4"></textarea>
          <small>例如：週一至週五 11:00-14:00, 17:00-21:00 / 週六 11:00-21:00 / 週日公休。</small>
        </div>
         <div className="form-group">
          <label htmlFor="shop-description">特色描述 (選填)</label>
          <textarea id="shop-description" value={description} onChange={(e) => setDescription(e.target.value)} rows="4"></textarea>
          <small>介紹店家特色、故事、招牌菜單等。</small>
        </div>
      </fieldset>

      {/* 媒體管理表單區域 */}
      <fieldset disabled={isSubmitting}>
        <legend>媒體管理</legend>

        {/* 編輯模式下顯示現有媒體 */}
        {isEditMode && existingMedia.length > 0 && (
            <div className="existing-media-section">
                <h4>現有照片/影片</h4>
                <div className="media-grid">
                    {existingMedia.map(media => {
                        const fullUrl = buildMediaUrl(media.url); // 獲取完整 URL
                        const isMarkedForDelete = deletedMediaIds.has(media.id);
                        return (
                             <div key={media.id} className={`media-item-wrapper ${isMarkedForDelete ? 'marked-for-delete' : ''}`}>
                                 {media.type === 'video' ? (
                                     <video src={fullUrl} className="media-preview" controls={false} muted playsInline preload="metadata" title={media.url}/> // 移除 controls，預覽即可
                                 ) : (
                                     <img src={fullUrl} alt={`現有媒體 ${media.id}`} className="media-preview" loading="lazy" title={media.url}/>
                                 )}
                                 {/* 標記/取消標記刪除按鈕 */}
                                 <button
                                     type="button"
                                     onClick={() => toggleDeleteExistingMedia(media.id)}
                                     className={`media-action-button ${isMarkedForDelete ? 'undelete-button' : 'delete-button'}`}
                                     title={isMarkedForDelete ? '取消刪除此項' : '標記刪除此項'}
                                 >
                                     {isMarkedForDelete ? '↩️' : '❌'} {/* 使用 Emoji 或文字 */}
                                 </button>
                             </div>
                         );
                    })}
                </div>
                <small>點擊 ❌ 將媒體標記為待刪除，點擊 ↩️ 取消標記。提交表單後生效。</small>
            </div>
        )}

        {/* 上傳新文件 */}
        <div className="form-group upload-section">
           <label htmlFor="shop-new-files">{isEditMode ? '上傳新照片/影片' : '上傳店家照片/影片'} (選填)</label>
           <input
               type="file"
               id="shop-new-files"
               multiple // 允許多選
               accept="image/*,video/*" // 接受圖片和影片
               onChange={handleFileChange}
               ref={fileInputRef} // 用於可能的重置
           />
        </div>
         {/* 新文件預覽 */}
         {newFilePreviews.length > 0 && (
             <div className="photo-previews new-photo-previews">
                 <p>新選擇的文件預覽：</p>
                 {newFilePreviews.map((previewUrl, index) => {
                      const fileType = newFiles[index]?.type || '';
                      return fileType.startsWith('video/') ?
                           (<video key={index} src={previewUrl} className="photo-preview-item" muted playsInline title={newFiles[index]?.name}/>)
                         : (<img key={index} src={previewUrl} alt={`新預覽 ${index + 1}`} className="photo-preview-item" title={newFiles[index]?.name}/>);
                 })}
             </div>
         )}

      </fieldset>

      {/* 提交按鈕 */}
      <div className="form-actions">
        <button type="submit" className="submit-button" disabled={isSubmitting || (externalError && !formError)}> {/* 如果有外部錯誤且無內部錯誤，也禁用 */}
          {isSubmitting ? '處理中...' : (isEditMode ? '更新店家資訊' : '新增店家')}
        </button>
         {/* 可選的取消按鈕 */}
         {/* <button type="button" onClick={() => navigate(-1)} className="cancel-button" disabled={isSubmitting}>取消</button> */}
      </div>
    </form>
  );
};

// --- PropTypes ---
ShopForm.propTypes = {
  isEditMode: PropTypes.bool.isRequired,
  initialData: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool.isRequired,
  error: PropTypes.string,
};

export default ShopForm;