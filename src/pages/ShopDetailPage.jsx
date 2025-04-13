// src/pages/ShopDetailPage.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { GoogleMap, MarkerF as Marker } from '@react-google-maps/api';
import Slider from "react-slick";
import apiClient from '../services/api';
import useAuth from '../hooks/useAuth';
import { Role } from '../constants/roles';
import ReviewCard from '../components/ReviewCard'; // 確保 ReviewCard.jsx 已更新
import Pagination from '../components/Pagination';
import AddReviewForm from '../components/AddReviewForm'; // 確保 AddReviewForm.jsx 已更新
import { renderStars } from '../utils/uiUtils';
import NotFoundPage from './NotFoundPage';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import './ShopDetailPage.css'; // 引入樣式

// --- 常量和輔助函數 ---
const mapContainerStyle = { width: '100%', height: '400px', borderRadius: '8px' };
const defaultMapOptions = { streetViewControl: false, mapTypeControl: false, fullscreenControl: true, zoomControl: true, gestureHandling: 'cooperative' };
const sliderSettings = { dots: true, infinite: false, speed: 500, slidesToShow: 1, slidesToScroll: 1, adaptiveHeight: true };
const buildMediaUrl = (relativePath) => { if (!relativePath) return '/placeholder-image.png'; if (relativePath.startsWith('http')) return relativePath; const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'; const uploadPath = '/uploads'; const cleanRelativePath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath; return `${baseUrl}${uploadPath}/${cleanRelativePath}`; };
const formatDateTime = (dateTimeString) => { if (!dateTimeString) return '未知'; try { return format(new Date(dateTimeString), 'yyyy年MM月dd日 HH:mm', { locale: zhTW }); } catch (e) { console.warn("日期格式化錯誤:", dateTimeString, e); return dateTimeString; } };
const renderMediaItem = (mediaItem, index) => { if (!mediaItem || !mediaItem.url) { console.warn(`[renderMediaItem] Invalid media item at index ${index} (missing url):`, mediaItem); return ( <div key={`placeholder-${index}`} className="shop-media-item placeholder"><span className="placeholder-text">媒體無效</span></div> ); } const url = buildMediaUrl(mediaItem.url); const type = (mediaItem.type && typeof mediaItem.type === 'string' && mediaItem.type.toLowerCase().includes('video')) ? 'VIDEO' : 'IMAGE'; console.log(`[renderMediaItem] Rendering index ${index}: URL=${url}, Type=${type}`); if (type === 'VIDEO') { return ( <div key={mediaItem.id || `video-${index}`} className="shop-media-item video-item"><video controls src={url} preload="metadata">您的瀏覽器不支持 Video 標籤。<a href={url} target="_blank" rel="noopener noreferrer">觀看影片</a></video></div> ); } else { return ( <div key={mediaItem.id || `image-${index}`} className="shop-media-item image-item"><img src={url} alt={`店家媒體 ${index + 1}`} loading="lazy" onError={(e) => { console.error(`[renderMediaItem] Error loading image: ${url}`); e.target.onerror = null; e.target.src = '/placeholder-image.png'; e.target.style.objectFit = 'contain'; }}/></div> ); } };
// --- ---

const ShopDetailPage = ({ mapLoaded, mapLoadError }) => {
    console.log('--- ShopDetailPage Component Rendering Start ---');
    const { id: shopId } = useParams();
    console.log('[ShopDetailPage] Shop ID from useParams:', shopId);
    const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // --- State ---
    const [shop, setShop] = useState(null);
    const [isLoadingShop, setIsLoadingShop] = useState(true);
    const [errorShop, setErrorShop] = useState('');
    const [reviews, setReviews] = useState([]);
    const [isLoadingReviews, setIsLoadingReviews] = useState(true);
    const [errorReviews, setErrorReviews] = useState('');
    const [reviewPagination, setReviewPagination] = useState({ currentPage: 0, totalPages: 0, pageSize: 5, totalElements: 0 });
    const [reviewSortBy, setReviewSortBy] = useState('createdAt');
    const [reviewSortDir, setReviewSortDir] = useState('DESC');
    const [editingReview, setEditingReview] = useState(null);
    const [replyingToReviewId, setReplyingToReviewId] = useState(null);
    const [repliesMap, setRepliesMap] = useState({});
    const [loadingRepliesMap, setLoadingRepliesMap] = useState({});
    const [expandedRepliesMap, setExpandedRepliesMap] = useState({});

    // --- Refs ---
    const reviewSectionRef = useRef(null);
    const reviewFormRef = useRef(null);
    const mapRef = useRef(null);

    // --- 判斷是否為店家主人 ---
    const isOwner = useMemo(() => {
        if (!isAuthenticated || !user || !shop || !shop.owner) return false;
        return String(user.id) === String(shop.owner.id);
    }, [isAuthenticated, user, shop]);

    // --- 回調函數：獲取店家詳情 ---
    const fetchShopDetails = useCallback(async () => {
        if (!shopId) { setIsLoadingShop(false); setErrorShop('無效的店家 ID。'); return Promise.reject('Invalid shop ID'); }
        console.log(`[fetchShopDetails] Fetching shop ${shopId}`);
        setIsLoadingShop(true); setErrorShop('');
        try {
            const response = await apiClient.get(`/shops/${shopId}`);
            if (response.data?.success && response.data?.data) { console.log('[fetchShopDetails] Success:', response.data.data); setShop(response.data.data); return response.data.data; }
            else { throw new Error(response.data?.message || '無法獲取店家信息'); }
        } catch (err) {
            console.error("[fetchShopDetails] Error:", err);
            const errMsg = err?.response?.data?.message || err?.data?.message || err?.message || '無法載入店家信息';
            if (err?.response?.status === 404 || err?.status === 404 || errMsg.includes('not found') || errMsg.includes('找不到')) { setErrorShop(`找不到 ID 為 ${shopId} 的店家。`); }
            else { setErrorShop(errMsg); }
            setShop(null); throw err;
        } finally { setIsLoadingShop(false); console.log(`[fetchShopDetails] Finished fetching shop ${shopId}`); }
    }, [shopId]); // 依賴 shopId

    // --- 回調函數：獲取評論 ---
    const fetchReviews = useCallback(async (page) => {
        if (!shopId) { console.log('[fetchReviews] Skipped: No shopId'); return; }
        console.log(`[fetchReviews] Starting for page ${page}, shopId ${shopId}`);
        setIsLoadingReviews(true); setErrorReviews(''); const safePage = Math.max(0, page);
        try {
            const params = { page: safePage, size: reviewPagination.pageSize, sortBy: reviewSortBy, sortDir: reviewSortDir };
            const response = await apiClient.get(`/reviews/shop/${shopId}`, { params });
            console.log('[fetchReviews] API Response Data:', response.data);
            if (response.data?.success && response.data?.data && typeof response.data.data === 'object') {
                 const d = response.data.data; const content = Array.isArray(d.content) ? d.content : [];
                 console.log(`[fetchReviews] Success: Found ${content.length} reviews. Total elements: ${d.totalElements}`);
                 setReviews(content); setReviewPagination(p => ({ ...p, currentPage: d.pageNo ?? 0, totalPages: d.totalPages ?? 0, totalElements: d.totalElements ?? 0 }));
            } else {
                 console.error('[fetchReviews] API call successful but response format is unexpected or success=false.', response.data);
                 setReviews([]); setReviewPagination(p => ({ ...p, currentPage: 0, totalPages: 0, totalElements: 0 }));
            }
        } catch (err) {
            console.error("[fetchReviews] Error caught:", err);
            const backendMessage = err?.response?.data?.message || err?.data?.message || err?.message || '無法載入評論';
            setErrorReviews(backendMessage); setReviews([]); setReviewPagination(p => ({ ...p, currentPage: 0, totalPages: 0, totalElements: 0 }));
        } finally { setIsLoadingReviews(false); console.log(`[fetchReviews] Finished fetching reviews for shop ${shopId}`); }
    }, [shopId, reviewPagination.pageSize, reviewSortBy, reviewSortDir]); // 依賴項

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
            } catch (error) { console.error(`[loadReplies] Error loading replies for ${parentReviewId}:`, error); setRepliesMap(prev => ({ ...prev, [idStr]: [] })); }
            finally { setLoadingRepliesMap(prev => ({ ...prev, [idStr]: false })); }
        }
    }, [repliesMap, loadingRepliesMap, expandedRepliesMap]);

    // --- 滾動到元素 ---
    const scrollToElement = (ref) => { if (ref.current) { ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); } };

    // --- 評論操作回調 ---
    const handleReviewAdded = useCallback((addedReviewDTO) => { const isReply = !!replyingToReviewId; setReplyingToReviewId(null); setEditingReview(null); alert(isReply ? '回覆成功！' : '評論成功！'); if (!isReply) { fetchShopDetails().catch(e => console.error("Error refetching shop:", e)); fetchReviews(0); } else { const parentId = addedReviewDTO.parentReviewId; setRepliesMap(p => { const n = { ...p }; delete n[String(parentId)]; return n; }); setExpandedRepliesMap(p => ({ ...p, [String(parentId)]: true })); loadReplies(parentId); setReviews(prev => prev.map(r => r.id === parentId ? { ...r, replyCount: (r.replyCount ?? 0) + 1 } : r)); } }, [replyingToReviewId, fetchReviews, fetchShopDetails, loadReplies]);
    // *** 修正 handleReviewUpdated ***
    const handleReviewUpdated = useCallback((updatedReviewDTO) => {
        const parentId = updatedReviewDTO?.parentReviewId;
        setEditingReview(null);
        alert('更新成功！');
        console.log('[handleReviewUpdated] Received updated review DTO:', updatedReviewDTO);
        if (!parentId) { // 更新頂級評論
            console.log('[handleReviewUpdated] Updating top-level review in state...');
            setReviews(prevReviews =>
                prevReviews.map(r => r.id === updatedReviewDTO.id ? updatedReviewDTO : r) // 使用返回的DTO更新
            );
            // 更新完 state 後再獲取店家信息
            fetchShopDetails().catch(e => console.error("Error refetching shop after update:", e));
        } else { // 更新回覆
            console.log('[handleReviewUpdated] Updating reply in state...');
            setRepliesMap(prevMap => {
                 const parentIdStr = String(parentId);
                 const currentReplies = prevMap[parentIdStr] || [];
                 const updatedReplies = currentReplies.map(reply => reply.id === updatedReviewDTO.id ? updatedReviewDTO : reply );
                 return { ...prevMap, [parentIdStr]: updatedReplies };
            });
            setExpandedRepliesMap(prev => ({ ...prev, [String(parentId)]: true }));
            // 通常不需要刷新頂級列表或店家信息，可以考慮重新加載回覆 (如果需要)
            // loadReplies(parentId);
        }
    }, [fetchShopDetails, loadReplies]); // 移除 reviewPagination.currentPage
    const handleCancelEdit = useCallback(() => { setEditingReview(null); setReplyingToReviewId(null); }, []);
    const handleDeleteReview = useCallback(async (id) => { if (!id || !window.confirm('確定刪除此評論或回覆嗎？')) return; try { let pId = null; let isTopLevel = false; const topLevelReview = reviews.find(r => r?.id === id); if (topLevelReview) { isTopLevel = true; } else { for (const parentId in repliesMap) { const reply = repliesMap[parentId]?.find(rp => rp?.id === id); if (reply) { pId = reply.parentReviewId; break; } } } await apiClient.delete(`/reviews/${id}`); alert('刪除成功'); if (editingReview?.id === id) setEditingReview(null); if (isTopLevel) { fetchShopDetails().catch(e => console.error("Error refetching shop:", e)); setRepliesMap(p => { const n = { ...p }; delete n[String(id)]; return n; }); setExpandedRepliesMap(p => { const n = { ...p }; delete n[String(id)]; return n; }); const { totalElements: pTE, pageSize: pS, currentPage: pC } = reviewPagination; const nTE = Math.max(0, pTE - 1); const nTP = Math.ceil(nTE / pS); let pTF = pC; if (pTF > 0 && pTF >= nTP) { pTF = Math.max(0, nTP - 1); } fetchReviews(pTF); } else if (pId) { setRepliesMap(p => { const n = { ...p }; const ps = String(pId); if (n[ps]) { n[ps] = n[ps].filter(rp => rp?.id !== id); } return n; }); setReviews(prev => prev.map(r => r.id === pId ? { ...r, replyCount: Math.max(0, (r.replyCount ?? 0) - 1) } : r)); } } catch (e) { console.error("刪除失敗:", e); alert(`刪除失敗: ${e?.response?.data?.message || e?.message}`); } }, [reviews, repliesMap, editingReview, reviewPagination, fetchReviews, fetchShopDetails]);
    const handleEditReview = useCallback((reviewToEdit) => { console.log('[handleEditReview] Function called with review:', reviewToEdit); console.log('[handleEditReview] Current user:', user); if (!reviewToEdit || !reviewToEdit.user || !user) { console.error('[handleEditReview] Invalid data: reviewToEdit or user is missing.'); return; } if (String(reviewToEdit.user.id) === String(user.id)) { console.log('[handleEditReview] User is authorized. Setting editing review...'); setReplyingToReviewId(null); setEditingReview(reviewToEdit); console.log('[handleEditReview] editingReview state should be set now.'); setTimeout(() => { console.log('[handleEditReview] Scrolling to form...'); scrollToElement(reviewFormRef); }, 100); } else { console.warn('[handleEditReview] Authorization failed. User ID mismatch.'); alert("您只能編輯自己的內容。"); } }, [user, scrollToElement, reviewFormRef]);
    const handleReplyToReview = useCallback((parentReviewId) => { setEditingReview(null); setReplyingToReviewId(parentReviewId); setTimeout(() => scrollToElement(reviewFormRef), 100); }, [scrollToElement, reviewFormRef]);
    const handleReviewPageChange = (pN) => { const sPN=Math.max(0,pN); if(sPN!==reviewPagination.currentPage){fetchReviews(sPN);scrollToElement(reviewSectionRef);} };
    const handleSortChange = (e) => { const nSV=e.target.value;let nSB='createdAt',nSD='DESC';if(nSV==='rating_desc'){nSB='rating';nSD='DESC';}else if(nSV==='rating_asc'){nSB='rating';nSD='ASC';} if(nSB!==reviewSortBy||nSD!==reviewSortDir){setReviewSortBy(nSB);setReviewSortDir(nSD);fetchReviews(0);}};
    // --- 地圖相關回調 ---
    const onMapLoad = useCallback((map) => { mapRef.current = map; console.log("[ShopDetailPage] Map loaded."); }, []);
    const onMapUnmount = useCallback(() => { mapRef.current = null; console.log("[ShopDetailPage] Map unmounted."); }, []);
    const handleMarkerClick = () => { /* No action */ };

    // --- useEffect for initial data loading ---
    useEffect(() => {
        console.log(`[ShopDetailPage] EFFECT RUN for shopId: ${shopId}`);
        setShop(null); setReviews([]); setErrorShop(''); setErrorReviews(''); setIsLoadingShop(true); setIsLoadingReviews(true);
        setEditingReview(null); setReplyingToReviewId(null); setReviewPagination(prev => ({ ...prev, currentPage: 0, totalPages: 0, totalElements: 0 }));
        setReviewSortBy('createdAt'); setReviewSortDir('DESC'); setRepliesMap({}); setLoadingRepliesMap({}); setExpandedRepliesMap({});
        if (shopId) {
            console.log(`[ShopDetailPage] Valid shopId ${shopId}. Starting parallel data fetch...`);
            Promise.all([ fetchShopDetails(), fetchReviews(0) ])
                .then(() => { console.log("[ShopDetailPage] Initial data fetch sequence potentially complete."); })
                .catch(error => { console.error("[ShopDetailPage] Error during initial parallel data load:", error); });
        } else {
            setErrorShop("無效的店家 ID。"); setIsLoadingShop(false); setIsLoadingReviews(false);
        }
        return () => { console.log(`[ShopDetailPage] EFFECT CLEANUP for shopId: ${shopId}`); };
    }, [shopId, fetchShopDetails, fetchReviews]); // *** 包含 fetch 回調作為依賴 ***

    // --- 主渲染邏輯 ---
    console.log('[ShopDetailPage] Render Check:', { isLoadingShop, isAuthLoading });
    if (isAuthLoading) { console.log('[ShopDetailPage] Rendering: Auth Loading...'); return <div className="loading page-loading" style={{ paddingTop: '5rem' }}>檢查登入狀態...</div>; }
    if (mapLoadError) { return ( <div className="shop-detail-page page-container"><NotFoundPage message={`地圖資源載入失敗: ${mapLoadError.message}`} /></div> ); }
    if (!mapLoaded) { return ( <div className="shop-detail-page page-container"><div className="loading page-loading" style={{ paddingTop: '5rem' }}>地圖資源初始化中...</div></div> ); }
    if (isLoadingShop) { console.log('[ShopDetailPage] Rendering: Shop Loading...'); return <div className="loading page-loading" style={{ paddingTop: '5rem' }}>載入店家資料...</div>; }
    if (errorShop && !shop) { return <NotFoundPage message={errorShop} />; }
    if (!shop) { console.error("[ShopDetailPage] Critical Error: Shop is null before rendering main content!"); return <NotFoundPage message={errorShop || "無法加載店家資料，請稍後再試。"} />; }

    // --- 準備渲染數據 ---
    const shopLocation = shop.latitude && shop.longitude ? { lat: parseFloat(shop.latitude), lng: parseFloat(shop.longitude) } : null;
    const shopAvgRating = parseFloat(shop.averageRating) || 0;
    const shopMediaList = Array.isArray(shop.media) ? shop.media : [];
    const shopOwnerIdForCheck = shop.owner?.id;
    const currentSliderSettings = { ...sliderSettings, infinite: shopMediaList.length > 1, arrows: shopMediaList.length > 1 };

    // --- JSX 渲染 ---
    console.log('[ShopDetailPage] Rendering main content...');
    return (
        <div className="shop-detail-page page-container">
            {/* 頁面標頭 */}
            <div className="page-header shop-detail-header"> <h1>{shop.name}</h1> {isOwner && ( <button onClick={() => navigate(`/shops/${shopId}/edit`)} className="edit-shop-button main-action-button">編輯店家資訊</button> )} </div>
            {/* 主要內容網格 */}
            <div className="shop-content-grid"> <div className="shop-info"> {shopMediaList.length > 0 ? ( <div className="shop-media-carousel-container"><Slider {...currentSliderSettings}>{shopMediaList.map(renderMediaItem)}</Slider></div> ) : ( <div className="shop-media-carousel-container placeholder"><span className="placeholder-text">店家尚未上傳圖片或影片</span></div> )} <p><strong>地址:</strong> {shop.address || '未提供'}</p> {shop.phone && <p><strong>電話:</strong> <a href={`tel:${shop.phone}`}>{shop.phone}</a></p>} {shop.openingHours && ( <div className="shop-info-block"><strong>營業時間:</strong><pre>{shop.openingHours}</pre></div> )} {shop.description && ( <div className="shop-info-block"><strong>特色描述:</strong><pre>{shop.description}</pre></div> )} <div className="shop-rating-summary"><strong>平均評分: </strong>{shopAvgRating > 0 ? (<>{renderStars(shopAvgRating)}<span className="rating-value"> {shopAvgRating.toFixed(1)} / 5</span><span className="rating-count"> ({shop.reviewCount || 0} 則評論)</span></>) : (<span> 尚無評分</span>)}</div> <p><small>最後更新於: {formatDateTime(shop.updatedAt)}</small></p> </div> <div className="shop-map"> {shopLocation ? ( <GoogleMap mapContainerStyle={mapContainerStyle} center={shopLocation} zoom={16} options={defaultMapOptions} onLoad={onMapLoad} onUnmount={onMapUnmount}><Marker position={shopLocation} title={shop.name} onClick={handleMarkerClick} /></GoogleMap> ) : ( <div className="map-placeholder">店家未提供座標。</div> )} </div> </div>
            {/* 評論區 */}
            <div className="review-section" ref={reviewSectionRef}> <h2>評論 ({reviewPagination.totalElements})</h2> {/* 表單區域 */} <div ref={reviewFormRef}> {editingReview && ( <AddReviewForm shopId={shopId} reviewToEdit={editingReview} onReviewUpdated={handleReviewUpdated} onCancelEdit={handleCancelEdit} isReplyMode={!!editingReview.parentReviewId} /> )} {replyingToReviewId && !editingReview && ( <AddReviewForm shopId={shopId} isReplyMode={true} parentReviewId={replyingToReviewId} onReviewAdded={handleReviewAdded} onCancelEdit={handleCancelEdit} /> )} {isAuthenticated && !isOwner && !editingReview && !replyingToReviewId && ( <AddReviewForm shopId={shopId} onReviewAdded={handleReviewAdded} onCancelEdit={null} /> )} {!isAuthenticated && !isAuthLoading && ( <p className="login-prompt">請先 <Link to="/login" state={{ from: location }}>登入</Link> 以發表評論。</p> )} </div> {/* 評論排序 */} {(reviewPagination.totalElements > 0 || isLoadingReviews) && ( <div className="review-controls"><div className="review-sort-controls"><label htmlFor="review-sort">排序: </label><select id="review-sort" value={reviewSortBy==='createdAt'?'createdAt_desc':(reviewSortDir==='DESC'?'rating_desc':'rating_asc')} onChange={handleSortChange} disabled={isLoadingReviews}><option value="createdAt_desc">最新</option><option value="rating_desc">評分高到低</option><option value="rating_asc">評分低到高</option></select></div></div> )} {/* 評論列表渲染 */} <div className="review-list-container"> {isLoadingReviews && <div className="loading">載入評論中...</div>} {errorReviews && !isLoadingReviews && <div className="error">錯誤: {errorReviews}</div>} {!isLoadingReviews && !errorReviews && reviews.length === 0 && ( <div className="no-results">目前還沒有評論。</div> )} {!isLoadingReviews && !errorReviews && reviews.length > 0 && ( <div className="review-list"> {reviews.map((review) => { if (!review || !review.user) { console.warn('[ShopDetailPage] Skipping invalid review object during render:', review); return null; } const reviewIdStr = String(review.id); const isEditingThisTopLevel = editingReview?.id === review.id && !editingReview?.parentReviewId; const currentReplies = repliesMap[reviewIdStr] || []; const isLoadingCurrentReplies = loadingRepliesMap[reviewIdStr] || false; const areRepliesExpanded = expandedRepliesMap[reviewIdStr] || false; const canUserEditThis = !!user && String(review.user.id) === String(user.id); if (isEditingThisTopLevel) return null; return ( <div key={review.id} className="review-item-container"> <ReviewCard review={review} isReply={false} shopOwnerId={shopOwnerIdForCheck} currentUserId={user?.id} isShopOwnerViewing={isOwner} onDelete={canUserEditThis ? handleDeleteReview : null} onEdit={canUserEditThis ? handleEditReview : null} onReply={isOwner ? handleReplyToReview : null} onLoadReplies={loadReplies} isExpanded={areRepliesExpanded} replyCount={review.replyCount ?? 0} isLoadingReplies={isLoadingCurrentReplies} /> {areRepliesExpanded && ( <div className="replies-list-container"> {isLoadingCurrentReplies ? (<div className="loading">載入回覆中...</div>) : (currentReplies.length > 0 ? ( currentReplies.map(reply => { if (!reply || !reply.user) return null; const isEditingThisReply = editingReview?.id === reply.id; const canUserEditReply = !!user && String(reply.user.id) === String(user.id); if (isEditingThisReply) return null; return (<ReviewCard key={reply.id} review={reply} isReply={true} shopOwnerId={shopOwnerIdForCheck} currentUserId={user?.id} isShopOwnerViewing={isOwner} onDelete={canUserEditReply ? handleDeleteReview : null} onEdit={canUserEditReply ? handleEditReview : null} onReply={null} onLoadReplies={null} />); }) ) : (<p className="no-replies">目前沒有回覆。</p>) )} </div> )} </div> ); })} </div> )} </div> {/* 評論分頁 */} {!isLoadingReviews && !errorReviews && reviewPagination.totalPages > 1 && ( <div className="pagination-container"> <Pagination currentPage={reviewPagination.currentPage} totalPages={reviewPagination.totalPages} onPageChange={handleReviewPageChange} /> </div> )} </div>
        </div>
    );
};

export default ShopDetailPage;