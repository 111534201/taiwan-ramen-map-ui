// src/pages/ShopDetailPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react'; // *** 確保 useCallback 已導入 ***
import { useParams, Link, useNavigate } from 'react-router-dom';
import { GoogleMap, MarkerF as Marker } from '@react-google-maps/api';
import Slider from "react-slick";
import apiClient from '../services/api';
import ReviewCard from '../components/ReviewCard';
import Pagination from '../components/Pagination';
import AddReviewForm from '../components/AddReviewForm';
import { renderStars } from '../utils/uiUtils'; // 從 utils 導入
import './ShopDetailPage.css';
import useAuth from '../hooks/useAuth';         // 確保導入正確
import NotFoundPage from './NotFoundPage';
import { Role } from '../constants/roles';      // 確保導入 Role
import { format } from 'date-fns';          // 導入日期格式化
import { zhTW } from 'date-fns/locale';     // 導入中文語系

// --- 常量定義 ---
const mapContainerStyle = { width: '100%', height: '400px', borderRadius: '8px' };
const defaultMapOptions = { streetViewControl: false, mapTypeControl: false, fullscreenControl: false, zoomControl: true, gestureHandling: 'cooperative' };
const sliderSettings = { dots: true, infinite: false, speed: 500, slidesToShow: 1, slidesToScroll: 1, adaptiveHeight: true };
// --- ---

// --- 輔助函數：構建媒體 URL ---
const buildMediaUrl = (relativePath) => {
    if (!relativePath) return '/placeholder-image.png';
    if (relativePath.startsWith('http')) return relativePath;
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
    const uploadPath = '/uploads';
    const cleanRelativePath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    return `${baseUrl}${uploadPath}/${cleanRelativePath}`;
};
// --- ---


const ShopDetailPage = ({ mapLoaded, mapLoadError }) => {
    const { id: shopId } = useParams();
    const numericShopId = parseInt(shopId, 10);
    const isValidShopId = !isNaN(numericShopId);

    const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const navigate = useNavigate();

    // --- State ---
    const [shop, setShop] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [isLoadingShop, setIsLoadingShop] = useState(true);
    const [isLoadingReviews, setIsLoadingReviews] = useState(false);
    const [errorShop, setErrorShop] = useState('');
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

    // --- 回調函數 ---
    // fetchShopDetails, fetchReviews, loadReplies 等回調函數保持不變 (使用 useCallback)
    const fetchShopDetails = useCallback(async () => { if (!isValidShopId || isAuthLoading) { return; } setIsLoadingShop(true); setErrorShop(''); try { const response = await apiClient.get(`/shops/${numericShopId}`); if (response.data?.success && response.data?.data) { console.log('[ShopDetailPage] Raw shop data from API:', response.data.data); setShop(response.data.data); } else { throw new Error(response.data?.message || `無法獲取店家信息`); } } catch (err) { console.error("[fetchShopDetails] Error:", err); const sc=err?.response?.status; let msg=err?.response?.data?.message||err?.message||'無法載入店家詳情'; if(sc===404)msg=`找不到ID ${numericShopId} 的店家。`; setErrorShop(msg); setShop(null); throw err; } }, [numericShopId, isValidShopId, shopId, isAuthLoading]);
    const fetchReviews = useCallback(async (page) => { if (!isValidShopId) return; setIsLoadingReviews(true); setErrorReviews(''); const safePage=Math.max(0,page); try { const params = { page: safePage, size: reviewPagination.pageSize, sortBy: reviewSortBy, sortDir: reviewSortDir }; const response = await apiClient.get(`/reviews/shop/${numericShopId}`, { params }); if (response.data?.success && response.data?.data) { const d=response.data.data; setReviews(Array.isArray(d.content)?d.content:[]); setReviewPagination(p=>({...p, currentPage:d.pageNo??0, totalPages:d.totalPages??0, totalElements:d.totalElements??0})); } else { throw new Error(response.data?.message || '無法獲取評論'); } } catch (err) { console.error("[fetchReviews] Error:", err); setErrorReviews(err?.response?.data?.message || err?.message || '無法載入評論'); setReviews([]); } finally { setIsLoadingReviews(false); } }, [numericShopId, isValidShopId, reviewPagination.pageSize, reviewSortBy, reviewSortDir]);
    const loadReplies = useCallback(async (pId) => { const idStr=String(pId); const isExp=expandedRepliesMap[idStr]; const isLd=loadingRepliesMap[idStr]; const aldLd=!!repliesMap[idStr]; setExpandedRepliesMap(p=>({...p,[idStr]:!isExp})); if(!isExp&&!aldLd&&!isLd){ setLoadingRepliesMap(p=>({...p,[idStr]:true})); try{ const res=await apiClient.get(`/reviews/${pId}/replies`); if(res.data?.success&&Array.isArray(res.data.data)){setRepliesMap(p=>({...p,[idStr]:res.data.data}));} else {throw new Error(res.data?.message||'無法獲取回覆');}}catch(e){console.error(`[loadReplies] E:`,e); setRepliesMap(p=>({...p,[idStr]:[]}));}finally{setLoadingRepliesMap(p=>({...p,[idStr]:false}));}} }, [expandedRepliesMap, loadingRepliesMap, repliesMap]);
    const scrollToElement = (ref) => { if (ref.current) { ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); } };
    const handleReviewAdded = useCallback(() => { const pId=replyingToReviewId; setReplyingToReviewId(null); setEditingReview(null); fetchShopDetails(); if(!pId){fetchReviews(0);}else{setRepliesMap(p=>{const n={...p};delete n[String(pId)];return n;}); setExpandedRepliesMap(p=>({...p,[String(pId)]:true})); loadReplies(pId); fetchReviews(reviewPagination.currentPage);}}, [replyingToReviewId, fetchShopDetails, fetchReviews, loadReplies, reviewPagination.currentPage]);
    const handleReviewUpdated = useCallback(() => { const pId=editingReview?.parentReviewId; setEditingReview(null); fetchShopDetails(); if(!pId){fetchReviews(reviewPagination.currentPage);}else{setRepliesMap(p=>{const n={...p};delete n[String(pId)];return n;}); setExpandedRepliesMap(p=>({...p,[String(pId)]:true})); loadReplies(pId);}}, [editingReview, reviewPagination.currentPage, fetchShopDetails, fetchReviews, loadReplies]);
    const handleCancelEdit = useCallback(() => { setEditingReview(null); setReplyingToReviewId(null); }, []);
    const handleDeleteReview = useCallback(async (id) => { if(!id||!window.confirm('確定刪除?'))return; try{let pId=null;const t=reviews.find(r=>r?.id===id);if(!t){for(const pid in repliesMap){const r=repliesMap[pid]?.find(rp=>rp?.id===id);if(r){pId=r.parentReviewId;break;}}} await apiClient.delete(`/reviews/${id}`); alert('刪除成功'); if(editingReview?.id===id)setEditingReview(null);if(replyingToReviewId===id)setReplyingToReviewId(null); fetchShopDetails(); if(!pId){setRepliesMap(p=>{const n={...p};delete n[String(id)];return n;}); setExpandedRepliesMap(p=>{const n={...p};delete n[String(id)];return n;}); const{totalElements:pTE,pageSize:pS,currentPage:pC}=reviewPagination;const nTE=Math.max(0,pTE-1);const nTP=Math.ceil(nTE/pS);let pTF=pC;if(pTF>0&&pTF>=nTP){pTF=Math.max(0,nTP-1);} fetchReviews(pTF);}else{setRepliesMap(p=>{const n={...p};const ps=String(pId);if(n[ps]){n[ps]=n[ps].filter(rp=>rp?.id!==id);}return n;});fetchReviews(reviewPagination.currentPage);}}catch(e){console.error("刪除失敗:",e);alert(`刪除失敗: ${e?.data?.message||e?.message}`);} }, [reviews, repliesMap, editingReview, replyingToReviewId, reviewPagination, fetchReviews, fetchShopDetails]);
    const handleEditReview = useCallback((r) => { if(r?.user?.id===user?.id){setReplyingToReviewId(null);setEditingReview(r);setTimeout(()=>scrollToElement(reviewFormRef),100);}else{alert("只能編輯自己的");}}, [user?.id]);
    const handleReplyToReview = useCallback((pId) => { setEditingReview(null); setReplyingToReviewId(pId); setTimeout(()=>scrollToElement(reviewFormRef),100); }, []);
    const handleReviewPageChange = (pN) => { const sPN=Math.max(0,pN); if(sPN!==reviewPagination.currentPage){fetchReviews(sPN);scrollToElement(reviewSectionRef);} };
    const handleSortChange = (e) => { const nSV=e.target.value;let nSB='createdAt',nSD='DESC';if(nSV==='rating_desc'){nSB='rating';nSD='DESC';}else if(nSV==='rating_asc'){nSB='rating';nSD='ASC';} setReviewSortBy(nSB);setReviewSortDir(nSD);fetchReviews(0); };
    // --- ---

    // --- useEffect for initial data loading ---
    useEffect(() => {
        if (!isValidShopId) { setErrorShop(`無效的店家 ID: ${shopId}`); setIsLoadingShop(false); setShop(null); setReviews([]); return; }
        if (isAuthLoading) return;

        console.log(`[ShopDetailPage] useEffect loading for shopId: ${numericShopId}`);
        setShop(null); setReviews([]); setErrorShop(''); setErrorReviews(''); setIsLoadingShop(true); setIsLoadingReviews(false);
        setEditingReview(null); setReplyingToReviewId(null);
        setReviewPagination(prev => ({ ...prev, currentPage: 0, totalPages: 0, totalElements: 0 }));
        setReviewSortBy('createdAt'); setReviewSortDir('DESC');
        setRepliesMap({}); setLoadingRepliesMap({}); setExpandedRepliesMap({});

        const loadInitialData = async () => {
            console.log('[useEffect] Calling loadInitialData...');
            try {
                await fetchShopDetails();
                // 可以在 fetchShopDetails 成功後再獲取評論
                // if (!errorShop && shop) { // 但 state 可能尚未更新
                    await fetchReviews(0);
                // }
            } catch (error) { console.error("[useEffect] Error during initial data load:", error); }
            finally { console.log('[useEffect] loadInitialData finally block. Setting isLoadingShop to false.'); setIsLoadingShop(false); }
        };
        loadInitialData();
    }, [numericShopId, isValidShopId, shopId, fetchShopDetails, fetchReviews, isAuthLoading]);

    // --- 輔助函數：判斷編輯權限 ---
    const canEditShop = useCallback(() => {
        if (!isAuthenticated || !shop || !user) return false;
        if (user.roles?.includes(Role.ROLE_ADMIN)) return true;
        if (user.roles?.includes(Role.ROLE_SHOP_OWNER) && shop.owner?.id && user.id && shop.owner.id === user.id) { // 使用 ===
            return true;
        }
        return false;
    }, [isAuthenticated, user, shop]);

    // --- 輔助函數：渲染媒體 ---
    const renderMediaItem = (mediaItem) => {
        if (!mediaItem || !mediaItem.url) { return (<div key={mediaItem?.id || Math.random()} className="carousel-item"><div className="carousel-unknown">無法顯示媒體</div></div>); }
        const fullUrl = buildMediaUrl(mediaItem.url);
        if (!fullUrl) return null;
        const isVideo = mediaItem.type === 'video' || /\.(mp4|webm|ogg)$/i.test(mediaItem.url);
        return ( <div key={mediaItem.id || mediaItem.url} className="carousel-item"> {isVideo ? (<video className="carousel-video" src={fullUrl} controls playsInline muted loop preload="metadata" onError={(e) => console.error("Video Error:", e.target.error)}/>) : (<img className="carousel-image" src={fullUrl} alt={shop?.name ? `${shop.name} 媒體` : '店家媒體'} loading="lazy" onError={(e) => { e.target.onerror=null; e.target.src='/placeholder-image.png'; }}/>)} </div> );
      };
    // --- ---

    // --- 格式化日期 ---
    const formatDateTime = (dateTimeString) => {
        if (!dateTimeString) return 'N/A';
        try { return format(new Date(dateTimeString), 'yyyy/MM/dd HH:mm', { locale: zhTW }); }
        catch (e) { console.error("Date format error:", e); return '無效日期'; }
    }

    // --- 主渲染邏輯 ---
    if (isLoadingShop || isAuthLoading) { return <div className="loading page-loading" style={{ paddingTop: '5rem' }}>載入店家詳情中...</div>; }
    if (errorShop) { return <NotFoundPage message={errorShop} />; }
    if (!shop) { return <NotFoundPage message="無法載入店家資料或店家不存在。" />; }

    // --- 準備渲染數據 ---
    const shopLat = shop.latitude ? parseFloat(shop.latitude) : null;
    const shopLng = shop.longitude ? parseFloat(shop.longitude) : null;
    const shopLocation = shopLat !== null && shopLng !== null && !isNaN(shopLat) && !isNaN(shopLng) ? { lat: shopLat, lng: shopLng } : null;
    const shopAvgRating = parseFloat(shop.averageRating) || 0;
    const shopMediaList = Array.isArray(shop.media) ? shop.media : [];
    const shopOwnerIdForCheck = shop.owner?.id;
    const currentSliderSettings = { ...sliderSettings, infinite: shopMediaList.length > 1, arrows: shopMediaList.length > 1 };
    const isCurrentUserShopOwner = isAuthenticated && user?.roles?.includes(Role.ROLE_SHOP_OWNER) && !!shopOwnerIdForCheck && !!user?.id && shopOwnerIdForCheck === user.id; // 使用 ===
    // --- ---

    // --- JSX 渲染 ---
    return (
        <div className="shop-detail-page page-container">
            {/* 店家標頭 */}
            <div className="shop-header">
                <h1>{shop.name || '讀取中...'}</h1> {/* 直接渲染 */}
                {canEditShop() && ( <button onClick={() => navigate(`/shops/${numericShopId}/edit`)} className="edit-shop-button main-action-button">編輯店家資訊</button> )}
                <div className="shop-rating-summary"> <span className="stars">{renderStars(shopAvgRating)}</span> <span>{shopAvgRating > 0 ? shopAvgRating.toFixed(1) : 'N/A'} / 5</span> <span>({reviewPagination.totalElements} 則評論)</span> </div>
            </div>
            {/* 主要內容網格 */}
            <div className="shop-content-grid">
                <div className="shop-info"> {/* 左側 */}
                    {shopMediaList.length > 0 ? ( <div className="shop-media-carousel-container"><Slider {...currentSliderSettings}>{shopMediaList.map(renderMediaItem)}</Slider></div> ) : ( <div className="shop-media-carousel-container placeholder"><span className="placeholder-text">店家尚未上傳圖片或影片</span></div> )}
                    <p><strong>地址:</strong> {shop.address || '未提供'}</p> {/* 直接渲染 */}
                    {shop.phone && <p><strong>電話:</strong> <a href={`tel:${shop.phone}`}>{shop.phone}</a></p>} {/* 直接渲染 */}
                    {shop.openingHours && ( <div className="shop-info-block"><strong>營業時間:</strong><pre>{shop.openingHours}</pre></div> )}
                    {shop.description && ( <div className="shop-info-block"><strong>特色描述:</strong><pre>{shop.description}</pre></div> )}
                    <p><small>最後更新於: {formatDateTime(shop.updatedAt)}</small></p>
                </div>
                <div className="shop-map"> {/* 右側 */}
                    {mapLoadError ? ( <div className="map-placeholder error-message">地圖載入失敗:{mapLoadError.message}</div> )
                     : !mapLoaded ? ( <div className="map-placeholder">地圖載入中...</div> )
                     : shopLocation ? ( <GoogleMap mapContainerStyle={mapContainerStyle} center={shopLocation} zoom={16} options={defaultMapOptions}><Marker position={shopLocation} title={shop.name} /></GoogleMap> )
                     : ( <div className="map-placeholder">店家未提供座標。</div> )}
                </div>
            </div>
            {/* 評論區 */}
            <div className="review-section" ref={reviewSectionRef}>
                <h2>評論 ({reviewPagination.totalElements})</h2>
                {/* 評論表單 */}
                <div ref={reviewFormRef}>
                    {editingReview && ( <AddReviewForm shopId={numericShopId} reviewToEdit={editingReview} onReviewUpdated={handleReviewUpdated} onCancelEdit={handleCancelEdit} isReplyMode={!!editingReview.parentReviewId} /> )}
                    {replyingToReviewId && !editingReview && ( <AddReviewForm shopId={numericShopId} isReplyMode={true} parentReviewId={replyingToReviewId} onReviewAdded={handleReviewAdded} onCancelEdit={handleCancelEdit} /> )}
                    {isAuthenticated && !isCurrentUserShopOwner && !editingReview && !replyingToReviewId && ( <AddReviewForm shopId={numericShopId} onReviewAdded={handleReviewAdded} isReplyMode={false} /> )}
                    {isCurrentUserShopOwner && !editingReview && !replyingToReviewId && ( <p className="owner-prompt">店家本人無法發表新評論，但可以回覆顧客的評論。</p> )}
                </div>
                {/* 登入提示 */}
                {!isAuthenticated && !editingReview && !replyingToReviewId && ( <p className="login-prompt"> <Link to="/login" state={{ from: `/shops/${numericShopId}` }}>登入</Link> 後即可發表或回覆評論。 </p> )}
                {/* 評論排序 */}
                {(reviewPagination.totalElements > 0 || isLoadingReviews) && ( <div className="review-controls"><div className="review-sort-controls"><label htmlFor="review-sort">排序: </label><select id="review-sort" value={reviewSortBy==='createdAt'?'createdAt_desc':(reviewSortDir==='DESC'?'rating_desc':'rating_asc')} onChange={handleSortChange} disabled={isLoadingReviews}><option value="createdAt_desc">最新</option><option value="rating_desc">評分高</option><option value="rating_asc">評分低</option></select></div></div> )}
                {/* 評論列表 */}
                {isLoadingReviews && reviews.length === 0 && <div className="loading">載入評論中...</div>}
                {errorReviews && !isLoadingReviews && <div className="error">錯誤: {errorReviews}</div>}
                {!isLoadingReviews && !errorReviews && reviews.length === 0 && reviewPagination.totalElements === 0 && ( <div className="no-results">目前還沒有評論。</div> )}
                <div className="review-list">
                    {Array.isArray(reviews) && reviews.map((review) => {
                      if (!review || !review.user) return null;
                      const reviewIdStr = String(review.id);
                      const isEditingThis = editingReview?.id === review.id;
                      const currentReplies = repliesMap[reviewIdStr] || [];
                      const isLoadingCurrentReplies = loadingRepliesMap[reviewIdStr] || false;
                      const areRepliesExpanded = expandedRepliesMap[reviewIdStr] || false;
                      if (isEditingThis && !review.parentReviewId) return null;
                      return (
                        <div key={review.id} className="review-item-container">
                            <ReviewCard review={review} isReply={false} shopOwnerId={shopOwnerIdForCheck} onDelete={handleDeleteReview} onEdit={handleEditReview} onReply={handleReplyToReview} onLoadReplies={loadReplies} isExpanded={areRepliesExpanded} replyCount={review.replyCount ?? 0} />
                            {areRepliesExpanded && ( <div className="replies-list-container"> {isLoadingCurrentReplies ? ( <div className="loading">載入回覆中...</div> ) : ( currentReplies.length > 0 ? ( currentReplies.map(reply => { if (!reply || !reply.user) return null; const isEditingThisReply = editingReview?.id === reply.id; if (isEditingThisReply) return null; return ( <ReviewCard key={reply.id} review={reply} isReply={true} shopOwnerId={shopOwnerIdForCheck} onDelete={handleDeleteReview} onEdit={handleEditReview} onReply={null} onLoadReplies={null} /> ); }) ) : ( <p className="no-replies">目前沒有回覆。</p> ) )} </div> )}
                        </div> ); })}
                </div>
                {/* 評論分頁 */}
                {!isLoadingReviews && !errorReviews && reviewPagination.totalPages > 1 && ( <div className="pagination-container"> <Pagination currentPage={reviewPagination.currentPage} totalPages={reviewPagination.totalPages} onPageChange={handleReviewPageChange} /> </div> )}
            </div>
        </div>
    );
};

export default ShopDetailPage;