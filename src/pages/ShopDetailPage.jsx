// src/pages/ShopDetailPage.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { GoogleMap, MarkerF as Marker } from '@react-google-maps/api';
import Slider from "react-slick"; // 引入 react-slick
import "slick-carousel/slick/slick.css"; // react-slick 基礎樣式
import "slick-carousel/slick/slick-theme.css"; // react-slick 主題樣式
import apiClient from '../services/api';
import useAuth from '../hooks/useAuth';
import { Role } from '../constants/roles'; // 假設你有定義角色的常量
import ReviewCard from '../components/ReviewCard';
import Pagination from '../components/Pagination';
import AddReviewForm from '../components/AddReviewForm';
import { renderStars } from '../utils/uiUtils'; // 假設你有星星渲染工具函數
import NotFoundPage from './NotFoundPage'; // 引入 404 頁面
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import './ShopDetailPage.css'; // 引入頁面樣式

// --- 常量和輔助函數 ---
const mapContainerStyle = { width: '100%', height: '400px', borderRadius: '8px' };
const defaultMapOptions = { streetViewControl: false, mapTypeControl: false, fullscreenControl: true, zoomControl: true, gestureHandling: 'cooperative' };
const sliderSettings = { dots: true, infinite: false, speed: 500, slidesToShow: 1, slidesToScroll: 1, adaptiveHeight: true };

// 構建媒體 URL
const buildMediaUrl = (relativePath) => {
    if (!relativePath) return '/placeholder-image.png'; // 預設圖片
    if (relativePath.startsWith('http')) return relativePath; // 絕對 URL 直接返回
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
    const uploadPath = '/uploads'; // 與後端 WebConfig 匹配
    const cleanRelativePath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    // 確保路徑分隔符統一為 /
    const normalizedRelativePath = cleanRelativePath.replace(/\\/g, '/');
    // 拼接路徑
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
    const cleanUploadUrlPath = uploadPath.startsWith('/') ? uploadPath : '/' + uploadPath;
    const finalUploadPath = cleanUploadUrlPath.endsWith('/') ? cleanUploadUrlPath : cleanUploadUrlPath + '/';
    return `${cleanBaseUrl}${finalUploadPath}${normalizedRelativePath}`;
};

// 格式化日期時間
const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return '未知';
    try {
        const date = new Date(dateTimeString);
        if (isNaN(date.getTime())) {
            console.warn("無效的日期格式:", dateTimeString);
            return dateTimeString;
        }
        return format(date, 'yyyy年MM月dd日 HH:mm', { locale: zhTW });
    } catch (e) {
        console.error("日期格式化時發生錯誤:", dateTimeString, e);
        return dateTimeString;
    }
};

// 渲染媒體項目 (圖片或影片)
const renderMediaItem = (mediaItem, index) => {
    if (!mediaItem || !mediaItem.url) {
        console.warn(`[renderMediaItem] Invalid media item at index ${index}`, mediaItem);
        return ( <div key={`placeholder-${index}`} className="shop-media-item placeholder"><span className="placeholder-text">媒體加載失敗</span></div> );
    }
    const url = buildMediaUrl(mediaItem.url);
    const type = (mediaItem.type && typeof mediaItem.type === 'string' && mediaItem.type.toLowerCase().includes('video')) ? 'VIDEO' : 'IMAGE';
    if (type === 'VIDEO') {
        return ( <div key={mediaItem.id || `video-${index}`} className="shop-media-item video-item"><video controls src={url} preload="metadata" playsInline style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}>您的瀏覽器不支持 Video 標籤。<a href={url} target="_blank" rel="noopener noreferrer">觀看影片</a></video></div> );
    } else {
        return ( <div key={mediaItem.id || `image-${index}`} className="shop-media-item image-item"><img src={url} alt={`店家媒體 ${index + 1}`} loading="lazy" onError={(e) => { console.error(`[renderMediaItem] Error loading image: ${url}`); e.target.onerror = null; e.target.src = '/placeholder-image.png'; e.target.style.objectFit = 'contain'; }} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/></div> );
    }
};
// --- ---

const ShopDetailPage = ({ mapLoaded, mapLoadError }) => {
    const { id: shopId } = useParams(); // 從 URL 獲取店家 ID
    const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth(); // 獲取用戶認證信息
    const navigate = useNavigate();
    const location = useLocation(); // 用於登入後跳轉回來

    // --- State 定義 ---
    const [shop, setShop] = useState(null); // 店家詳細資訊
    const [isLoadingShop, setIsLoadingShop] = useState(true); // 是否正在加載店家資訊
    const [errorShop, setErrorShop] = useState(''); // 加載店家資訊的錯誤信息

    const [reviews, setReviews] = useState([]); // 評論列表 (當前頁)
    const [isLoadingReviews, setIsLoadingReviews] = useState(true); // 是否正在加載評論
    const [errorReviews, setErrorReviews] = useState(''); // 加載評論的錯誤信息
    const [reviewPagination, setReviewPagination] = useState({ currentPage: 0, totalPages: 0, pageSize: 5, totalElements: 0 }); // 評論分頁信息
    const [reviewSortBy, setReviewSortBy] = useState('createdAt'); // 評論排序字段
    const [reviewSortDir, setReviewSortDir] = useState('DESC'); // 評論排序方向

    const [editingReview, setEditingReview] = useState(null); // 正在編輯的評論對象 (用於傳給表單)
    const [replyingToReviewId, setReplyingToReviewId] = useState(null); // 正在回覆的父評論 ID

    const [repliesMap, setRepliesMap] = useState({}); // 存儲已加載的回覆 { parentId: [reply1, reply2] }
    const [loadingRepliesMap, setLoadingRepliesMap] = useState({}); // 標記哪些評論的回覆正在加載 { parentId: true }
    const [expandedRepliesMap, setExpandedRepliesMap] = useState({}); // 標記哪些評論的回覆列表已展開 { parentId: true }

    // --- Refs 定義 ---
    const reviewSectionRef = useRef(null); // 用於滾動到評論區
    const reviewFormRef = useRef(null); // 用於滾動到評論表單
    const mapRef = useRef(null); // Google Map 實例引用

    // --- 計算屬性 ---
    // 判斷當前用戶是否為店家主人
    const isOwner = useMemo(() => {
        if (!isAuthenticated || !user || !shop || !shop.owner) return false;
        // 確保比較 ID 時類型一致
        return String(user.id) === String(shop.owner.id);
    }, [isAuthenticated, user, shop]);

    // --- 回調函數：獲取店家詳情 ---
    const fetchShopDetails = useCallback(async () => {
        if (!shopId) { setIsLoadingShop(false); setErrorShop('無效的店家 ID。'); return Promise.reject('Invalid shop ID'); }
        setIsLoadingShop(true); setErrorShop('');
        try {
            const response = await apiClient.get(`/shops/${shopId}`);
            if (response.data?.success && response.data?.data) { setShop(response.data.data); return response.data.data; }
            else { throw new Error(response.data?.message || '無法獲取店家信息'); }
        } catch (err) {
            const errMsg = err?.response?.data?.message || err?.data?.message || err?.message || '無法載入店家信息';
            if (err?.response?.status === 404 || err?.status === 404 || errMsg.includes('not found') || errMsg.includes('找不到')) { setErrorShop(`找不到 ID 為 ${shopId} 的店家。`); }
            else { setErrorShop(errMsg); }
            setShop(null); throw err;
        } finally { setIsLoadingShop(false); }
    }, [shopId]);

    // --- 回調函數：獲取評論 ---
    const fetchReviews = useCallback(async (page) => {
        if (!shopId) { return; }
        setIsLoadingReviews(true); setErrorReviews(''); const safePage = Math.max(0, page);
        try {
            const params = { page: safePage, size: reviewPagination.pageSize, sortBy: reviewSortBy, sortDir: reviewSortDir };
            const response = await apiClient.get(`/reviews/shop/${shopId}`, { params });
            if (response.data?.success && response.data?.data && typeof response.data.data === 'object') {
                 const d = response.data.data; const content = Array.isArray(d.content) ? d.content : [];
                 setReviews(content); setReviewPagination(p => ({ ...p, currentPage: d.pageNo ?? 0, totalPages: d.totalPages ?? 0, totalElements: d.totalElements ?? 0 }));
            } else {
                 console.error('[fetchReviews] API 響應格式不正確或失敗', response.data);
                 setReviews([]); setReviewPagination(p => ({ ...p, currentPage: 0, totalPages: 0, totalElements: 0 }));
            }
        } catch (err) {
            const backendMessage = err?.response?.data?.message || err?.data?.message || err?.message || '無法載入評論';
            setErrorReviews(backendMessage); setReviews([]); setReviewPagination(p => ({ ...p, currentPage: 0, totalPages: 0, totalElements: 0 }));
        } finally { setIsLoadingReviews(false); }
    }, [shopId, reviewPagination.pageSize, reviewSortBy, reviewSortDir]);

    // --- 回調函數：加載回覆 ---
    const loadReplies = useCallback(async (parentReviewId) => {
        const idStr = String(parentReviewId); const alreadyLoaded = !!repliesMap[idStr]; const isLoading = loadingRepliesMap[idStr]; const isExpanded = expandedRepliesMap[idStr];
        setExpandedRepliesMap(prev => ({ ...prev, [idStr]: !isExpanded }));
        if (!isExpanded && !alreadyLoaded && !isLoading) {
            setLoadingRepliesMap(prev => ({ ...prev, [idStr]: true }));
            try {
                const response = await apiClient.get(`/reviews/${parentReviewId}/replies`);
                if (response.data?.success && Array.isArray(response.data.data)) { setRepliesMap(prev => ({ ...prev, [idStr]: response.data.data })); }
                else { throw new Error(response.data?.message || '無法獲取回覆'); }
            } catch (error) { console.error(`[loadReplies] 加載回覆失敗 (父評論 ID: ${parentReviewId}):`, error); setRepliesMap(prev => ({ ...prev, [idStr]: [] })); }
            finally { setLoadingRepliesMap(prev => ({ ...prev, [idStr]: false })); }
        }
    }, [repliesMap, loadingRepliesMap, expandedRepliesMap]);

    // --- 滾動到指定元素 ---
    const scrollToElement = (ref) => { if (ref.current) { ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); } };

    // --- 評論操作回調 ---
    const handleReviewAdded = useCallback((addedReviewDTO) => {
        const isReply = !!addedReviewDTO.parentReviewId;
        setReplyingToReviewId(null); setEditingReview(null);
        alert(isReply ? '回覆成功！' : '評論成功！');
        if (!isReply) {
            fetchShopDetails().catch(e => console.error("Error refetching shop after review added:", e));
            fetchReviews(0);
            scrollToElement(reviewSectionRef);
        } else {
            const parentId = addedReviewDTO.parentReviewId;
            setRepliesMap(p => { const n = { ...p }; delete n[String(parentId)]; return n; });
            setExpandedRepliesMap(p => ({ ...p, [String(parentId)]: true }));
            loadReplies(parentId);
            setReviews(prev => prev.map(r => r.id === parentId ? { ...r, replyCount: (r.replyCount ?? 0) + 1 } : r));
        }
    }, [fetchReviews, fetchShopDetails, loadReplies, reviewSectionRef]);

    // 評論更新後的回調 (現在只負責觸發刷新)
    const handleReviewUpdated = useCallback(() => {
        setEditingReview(null); // 關閉編輯表單
        alert('更新成功！');
        // 重新獲取當前頁評論和店家信息
        fetchReviews(reviewPagination.currentPage);
        fetchShopDetails().catch(e => console.error("Error refetching shop after review updated:", e));
    }, [fetchReviews, fetchShopDetails, reviewPagination.currentPage]);

    // 取消編輯/回覆的回調
    const handleCancelEdit = useCallback(() => {
        setEditingReview(null);
        setReplyingToReviewId(null);
    }, []);

    // 刪除評論/回覆的回調
    const handleDeleteReview = useCallback(async (idToDelete) => {
        if (!idToDelete || !window.confirm('確定刪除此評論或回覆嗎？此操作無法撤銷。')) return;
        try {
            let parentReviewIdToUpdate = null; let isTopLevelReview = false;
            const reviewIndex = reviews.findIndex(r => r?.id === idToDelete);
            if (reviewIndex > -1) { isTopLevelReview = true; }
            else { for (const parentIdStr in repliesMap) { const replyIndex = repliesMap[parentIdStr]?.findIndex(rp => rp?.id === idToDelete); if (replyIndex > -1) { parentReviewIdToUpdate = parseInt(parentIdStr, 10); break; } } }

            await apiClient.delete(`/reviews/${idToDelete}`);
            alert('刪除成功');
            if (editingReview?.id === idToDelete) setEditingReview(null);

            if (isTopLevelReview) {
                fetchShopDetails().catch(e => console.error("Error refetching shop after delete:", e));
                setRepliesMap(p => { const n = { ...p }; delete n[String(idToDelete)]; return n; });
                setExpandedRepliesMap(p => { const n = { ...p }; delete n[String(idToDelete)]; return n; });
                const { totalElements: prevTotal, pageSize: ps, currentPage: pc } = reviewPagination;
                const newTotal = Math.max(0, prevTotal - 1);
                const newTotalPages = Math.ceil(newTotal / ps);
                let pageToFetch = pc;
                if (pc > 0 && pc >= newTotalPages) pageToFetch = Math.max(0, newTotalPages - 1);
                fetchReviews(pageToFetch);
            } else if (parentReviewIdToUpdate) {
                setRepliesMap(p => { const n = { ...p }; const ps = String(parentReviewIdToUpdate); if (n[ps]) n[ps] = n[ps].filter(rp => rp?.id !== idToDelete); return n; });
                setReviews(prev => prev.map(r => r.id === parentReviewIdToUpdate ? { ...r, replyCount: Math.max(0, (r.replyCount ?? 0) - 1) } : r));
            }
        } catch (e) { console.error("刪除失敗:", e); alert(`刪除失敗: ${e?.response?.data?.message || e?.message}`); }
    }, [reviews, repliesMap, editingReview, reviewPagination, fetchReviews, fetchShopDetails]);

    // 觸發編輯模式的回調
    const handleEditReview = useCallback((reviewToEdit) => {
        if (!reviewToEdit || !user) { console.error('[handleEditReview] Invalid data or user not logged in.'); return; }
        setReplyingToReviewId(null); setEditingReview(reviewToEdit);
        setTimeout(() => { scrollToElement(reviewFormRef); }, 100);
    }, [user, scrollToElement, reviewFormRef]);

    // 觸發回覆模式的回調
    const handleReplyToReview = useCallback((parentReviewId) => {
        setEditingReview(null); setReplyingToReviewId(parentReviewId);
        setTimeout(() => scrollToElement(reviewFormRef), 100);
    }, [scrollToElement, reviewFormRef]);

    // 評論分頁改變的回調
    const handleReviewPageChange = (pageNumber) => {
        const safePageNumber = Math.max(0, pageNumber);
        if (safePageNumber !== reviewPagination.currentPage) { fetchReviews(safePageNumber); scrollToElement(reviewSectionRef); }
    };

    // 評論排序改變的回調
    const handleSortChange = (event) => {
        const selectedValue = event.target.value;
        let newSortBy = 'createdAt'; let newSortDir = 'DESC';
        if (selectedValue === 'rating_desc') { newSortBy = 'rating'; newSortDir = 'DESC'; }
        else if (selectedValue === 'rating_asc') { newSortBy = 'rating'; newSortDir = 'ASC'; }
        if (newSortBy !== reviewSortBy || newSortDir !== reviewSortDir) { setReviewSortBy(newSortBy); setReviewSortDir(newSortDir); fetchReviews(0); }
    };

    // --- 地圖相關回調 ---
    const onMapLoad = useCallback((map) => { mapRef.current = map; }, []);
    const onMapUnmount = useCallback(() => { mapRef.current = null; }, []);
    const handleMarkerClick = () => { /* 可選實現 */ };

    // --- useEffect for initial data loading ---
    useEffect(() => {
        setShop(null); setReviews([]); setErrorShop(''); setErrorReviews(''); setIsLoadingShop(true); setIsLoadingReviews(true);
        setEditingReview(null); setReplyingToReviewId(null); setReviewPagination(prev => ({ ...prev, currentPage: 0, totalPages: 0, totalElements: 0 }));
        setReviewSortBy('createdAt'); setReviewSortDir('DESC'); setRepliesMap({}); setLoadingRepliesMap({}); setExpandedRepliesMap({});
        if (shopId) {
            Promise.all([ fetchShopDetails(), fetchReviews(0) ])
                .catch(error => { console.error("[ShopDetailPage] Error during initial data load:", error); });
        } else { setErrorShop("無效的店家 ID。"); setIsLoadingShop(false); setIsLoadingReviews(false); }
    }, [shopId, fetchShopDetails, fetchReviews]);

    // --- 主渲染邏輯 ---
    if (isAuthLoading) { return <div className="loading page-loading">檢查登入狀態...</div>; }
    if (mapLoadError) { return ( <div className="shop-detail-page page-container"><NotFoundPage message={`地圖資源載入失敗: ${mapLoadError.message}`} /></div> ); }
    if (!mapLoaded) { return ( <div className="shop-detail-page page-container"><div className="loading page-loading">地圖資源初始化中...</div></div> ); }
    if (isLoadingShop) { return <div className="loading page-loading">載入店家資料...</div>; }
    if (errorShop && !shop) { return <NotFoundPage message={errorShop} />; }
    if (!shop) { return <NotFoundPage message="無法加載店家資料。" />; }

    const shopLocation = shop.latitude && shop.longitude ? { lat: parseFloat(shop.latitude), lng: parseFloat(shop.longitude) } : null;
    const shopAvgRating = parseFloat(shop.averageRating) || 0;
    const shopMediaList = Array.isArray(shop.media) ? shop.media : [];
    const shopOwnerIdForCheck = shop.owner?.id;
    const currentSliderSettings = { ...sliderSettings, infinite: shopMediaList.length > 1, arrows: shopMediaList.length > 1 };

    return (
        <div className="shop-detail-page page-container">
            {/* 頁面標頭 */}
            <div className="page-header shop-detail-header">
                <h1>{shop.name}</h1>
                {isOwner && (<button onClick={() => navigate(`/shops/${shopId}/edit`)} className="edit-shop-button main-action-button">編輯店家資訊</button>)}
            </div>

            {/* 主要內容網格 */}
            <div className="shop-content-grid">
                <div className="shop-info">
                    {/* 媒體輪播 */}
                    {shopMediaList.length > 0 ? (
                        <div className="shop-media-carousel-container">
                            <Slider {...currentSliderSettings}>
                                {shopMediaList.map(renderMediaItem)}
                            </Slider>
                        </div>
                    ) : ( <div className="shop-media-carousel-container placeholder"><span className="placeholder-text">店家尚未上傳圖片或影片</span></div> )}
                    {/* 其他信息 */}
                    <p><strong>地址:</strong> {shop.address || '未提供'}</p>
                    {shop.phone && <p><strong>電話:</strong> <a href={`tel:${shop.phone}`}>{shop.phone}</a></p>}
                    {shop.openingHours && ( <div className="shop-info-block"><strong>營業時間:</strong><pre>{shop.openingHours}</pre></div> )}
                    {shop.description && ( <div className="shop-info-block"><strong>特色描述:</strong><pre>{shop.description}</pre></div> )}
                    {/* 評分 */}
                    <div className="shop-rating-summary">
                         <strong>平均評分: </strong>
                         {shopAvgRating > 0 ? (<>{renderStars(shopAvgRating)}<span className="rating-value"> {shopAvgRating.toFixed(1)} / 5</span><span className="rating-count"> ({shop.reviewCount || 0} 則評論)</span></>) : (<span> 尚無評分</span>)}
                    </div>
                    <p><small>最後更新於: {formatDateTime(shop.updatedAt)}</small></p>
                </div>
                {/* 地圖 */}
                <div className="shop-map">
                    {shopLocation ? (<GoogleMap mapContainerStyle={mapContainerStyle} center={shopLocation} zoom={16} options={defaultMapOptions} onLoad={onMapLoad} onUnmount={onMapUnmount}><Marker position={shopLocation} title={shop.name} onClick={handleMarkerClick} /></GoogleMap>) : (<div className="map-placeholder">店家未提供座標。</div>)}
                </div>
            </div>

            {/* 評論區 */}
            <div className="review-section" ref={reviewSectionRef}>
                <h2>評論 ({reviewPagination.totalElements})</h2>

                {/* 評論表單區域 */}
                <div ref={reviewFormRef}>
                    {/* 編輯模式 */}
                    {editingReview && (<AddReviewForm shopId={shopId} reviewToEdit={editingReview} onReviewUpdated={handleReviewUpdated} onCancelEdit={handleCancelEdit} isReplyMode={!!editingReview.parentReviewId} />)}
                    {/* 回覆模式 */}
                    {replyingToReviewId && !editingReview && (<AddReviewForm shopId={shopId} isReplyMode={true} parentReviewId={replyingToReviewId} onReviewAdded={handleReviewAdded} onCancelEdit={handleCancelEdit} />)}
                    {/* 新增評論模式 (非店家) */}
                    {isAuthenticated && !isOwner && !editingReview && !replyingToReviewId && (<AddReviewForm shopId={shopId} onReviewAdded={handleReviewAdded} onCancelEdit={null} />)}
                    {/* 未登入提示 */}
                    {!isAuthenticated && !isAuthLoading && (<p className="login-prompt">請先 <Link to="/login" state={{ from: location }}>登入</Link> 以發表評論或回覆。</p>)}
                    {/* 店家提示 */}
                    {isAuthenticated && isOwner && !editingReview && !replyingToReviewId && (<p className="info-prompt">店家您好，您可以點擊評論旁的「回覆」按鈕來回應顧客。</p>)}
                </div>

                {/* 評論排序 */}
                {(reviewPagination.totalElements > 0 || isLoadingReviews) && (
                    <div className="review-controls">
                        <div className="review-sort-controls">
                            <label htmlFor="review-sort">排序: </label>
                            <select id="review-sort" value={reviewSortBy==='createdAt'?'createdAt_desc':(reviewSortDir==='DESC'?'rating_desc':'rating_asc')} onChange={handleSortChange} disabled={isLoadingReviews}>
                                <option value="createdAt_desc">最新</option>
                                <option value="rating_desc">評分高到低</option>
                                <option value="rating_asc">評分低到高</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* 評論列表渲染 */}
                <div className="review-list-container">
                    {isLoadingReviews && <div className="loading">載入評論中...</div>}
                    {errorReviews && !isLoadingReviews && <div className="error">錯誤: {errorReviews}</div>}
                    {!isLoadingReviews && !errorReviews && reviews.length === 0 && (<div className="no-results">目前還沒有評論。</div>)}
                    {!isLoadingReviews && !errorReviews && reviews.length > 0 && (
                        <div className="review-list">
                            {reviews.map((review) => {
                                if (!review || !review.user) return null;
                                const reviewIdStr = String(review.id);
                                const isEditingThisTopLevel = editingReview?.id === review.id && !editingReview?.parentReviewId;
                                const currentReplies = repliesMap[reviewIdStr] || [];
                                const isLoadingCurrentReplies = loadingRepliesMap[reviewIdStr] || false;
                                const areRepliesExpanded = expandedRepliesMap[reviewIdStr] || false;
                                const canUserEditThis = !!user && String(review.user.id) === String(user.id);

                                if (isEditingThisTopLevel) return null; // 正在編輯此評論，不顯示 Card

                                return (
                                    <div key={review.id} className="review-item-container">
                                        <ReviewCard
                                            review={review} isReply={false} shopOwnerId={shopOwnerIdForCheck}
                                            currentUserId={user?.id} isShopOwnerViewing={isOwner}
                                            onDelete={canUserEditThis ? handleDeleteReview : null}
                                            onEdit={canUserEditThis ? handleEditReview : null}
                                            onReply={isOwner ? handleReplyToReview : null} // 只有店家能看到回覆按鈕
                                            onLoadReplies={loadReplies} isExpanded={areRepliesExpanded}
                                            replyCount={review.replyCount ?? 0} isLoadingReplies={isLoadingCurrentReplies}
                                        />
                                        {/* 回覆列表 */}
                                        {areRepliesExpanded && (
                                            <div className="replies-list-container">
                                                 {isLoadingCurrentReplies ? (<div className="loading">載入回覆中...</div>) : (currentReplies.length > 0 ? ( currentReplies.map(reply => { if (!reply || !reply.user) return null; const isEditingThisReply = editingReview?.id === reply.id; const canUserEditReply = !!user && String(reply.user.id) === String(user.id); if (isEditingThisReply) return null; return (<ReviewCard key={reply.id} review={reply} isReply={true} shopOwnerId={shopOwnerIdForCheck} currentUserId={user?.id} isShopOwnerViewing={isOwner} onDelete={canUserEditReply ? handleDeleteReview : null} onEdit={canUserEditReply ? handleEditReview : null} onReply={null} onLoadReplies={null} />); }) ) : (<p className="no-replies">目前沒有回覆。</p>) )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 評論分頁 */}
                {!isLoadingReviews && !errorReviews && reviewPagination.totalPages > 1 && (
                    <div className="pagination-container">
                        <Pagination currentPage={reviewPagination.currentPage} totalPages={reviewPagination.totalPages} onPageChange={handleReviewPageChange} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShopDetailPage;