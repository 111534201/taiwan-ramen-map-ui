// src/pages/MyOwnedShopPage.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'; // 添加 useMemo
import { Link, useNavigate } from 'react-router-dom';
import { GoogleMap, MarkerF as Marker } from '@react-google-maps/api';
import Slider from "react-slick";
import apiClient from '../services/api';
import useAuth from '../hooks/useAuth'; // <--- 確保導入正確
import { Role } from '../constants/roles'; // <--- 確保導入正確
import ReviewCard from '../components/ReviewCard';
import Pagination from '../components/Pagination';
import AddReviewForm from '../components/AddReviewForm';
import { renderStars } from '../utils/uiUtils';
import NotFoundPage from './NotFoundPage';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import './ShopDetailPage.css';
import './MyOwnedShopPage.css';

// --- 常量和輔助函數 (保持不變) ---
const mapContainerStyle = { width: '100%', height: '400px', borderRadius: '8px' };
const defaultMapOptions = { streetViewControl: false, mapTypeControl: false, fullscreenControl: false, zoomControl: true, gestureHandling: 'cooperative' };
const sliderSettings = { dots: true, infinite: false, speed: 500, slidesToShow: 1, slidesToScroll: 1, adaptiveHeight: true };
const buildMediaUrl = (relativePath) => { /* ... (保持不變) ... */ };
const formatDateTime = (dateTimeString) => { /* ... (保持不變) ... */ };
// --- ---

const MyOwnedShopPage = ({ mapLoaded, mapLoadError }) => {
    const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const navigate = useNavigate();

    // --- State (保持不變) ---
    const [shop, setShop] = useState(null);
    const [isLoadingShop, setIsLoadingShop] = useState(true); // 初始設為 true
    const [errorShop, setErrorShop] = useState('');
    const [reviews, setReviews] = useState([]);
    const [isLoadingReviews, setIsLoadingReviews] = useState(false);
    const [errorReviews, setErrorReviews] = useState('');
    const [reviewPagination, setReviewPagination] = useState({ currentPage: 0, totalPages: 0, pageSize: 5, totalElements: 0 });
    const [reviewSortBy, setReviewSortBy] = useState('createdAt');
    const [reviewSortDir, setReviewSortDir] = useState('DESC');
    const [editingReview, setEditingReview] = useState(null);
    const [replyingToReviewId, setReplyingToReviewId] = useState(null);
    const [repliesMap, setRepliesMap] = useState({});
    const [loadingRepliesMap, setLoadingRepliesMap] = useState({});
    const [expandedRepliesMap, setExpandedRepliesMap] = useState({});

    // --- Refs (保持不變) ---
    const reviewSectionRef = useRef(null);
    const reviewFormRef = useRef(null);

    // --- Helper Function: 檢查用戶是否有店家角色 (統一邏輯) ---
    const isShopOwner = useMemo(() => {
        if (!user) return false;
        // 同時檢查 roles 陣列和 role 字符串
        const userRoles = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []);
        return userRoles.includes(Role.ROLE_SHOP_OWNER);
    }, [user]); // 只依賴 user

    // --- 獲取店家用戶擁有的店家 ID (使用 useMemo) ---
    const ownedShopId = useMemo(() => {
        // 確保是店家角色才繼續
        if (isShopOwner && user) {
            // 優先使用 roles 陣列中的 ownedShopIds
            if (Array.isArray(user.ownedShopIds) && user.ownedShopIds.length > 0) {
                return user.ownedShopIds[0]; // 取第一個
            }
            // 兼容舊的 ownedShopId 屬性
            if (user.ownedShopId) {
                 return user.ownedShopId;
            }
        }
        return null;
    }, [user, isShopOwner]); // 依賴 user 和 isShopOwner 的計算結果

    // --- 回調函數 (修改權限檢查) ---
     const fetchOwnedShopDetails = useCallback(async () => {
         // *** 修改權限檢查 ***
         if (isAuthLoading || !isAuthenticated || !isShopOwner || !ownedShopId) {
             setIsLoadingShop(false);
             if (!isAuthLoading && (!isAuthenticated || !isShopOwner)) { setErrorShop('只有店家用戶可以訪問此頁面。'); }
             else if (!isAuthLoading && !ownedShopId) { setErrorShop('無法找到您擁有的店家信息，請聯繫管理員。'); }
             return Promise.reject('條件不滿足，無法獲取店家信息');
         }
         // *** --- ***
         setIsLoadingShop(true); setErrorShop(''); setShop(null);
         try {
             const response = await apiClient.get(`/shops/${ownedShopId}`);
             if (response.data?.success && response.data?.data) { setShop(response.data.data); return response.data.data; }
             else { throw new Error(response.data?.message || `無法獲取您的店家信息`); }
         } catch (err) { console.error("[MyOwnedShopPage] Fetch error:", err); setErrorShop(err?.response?.data?.message || err?.message || '無法載入店家信息'); setShop(null); throw err; }
     }, [ownedShopId, isAuthenticated, isAuthLoading, isShopOwner]); // 使用 isShopOwner

    // --- 其他回調函數 fetchReviews, loadReplies, handleReviewAdded 等 (保持不變，或根據需要微調) ---
    const fetchReviews = useCallback(async (page) => { /* ... (保持不變) ... */ }, [ownedShopId, reviewPagination.pageSize, reviewSortBy, reviewSortDir]);
    const loadReplies = useCallback(async (pId) => { /* ... (保持不變) ... */ }, [expandedRepliesMap, loadingRepliesMap, repliesMap]);
    const scrollToElement = (ref) => { /* ... (保持不變) ... */ };
    const handleReviewAdded = useCallback((addedReview) => { /* ... (保持不變) ... */ }, [replyingToReviewId, fetchReviews, loadReplies, reviewPagination.currentPage]);
    const handleReviewUpdated = useCallback((updatedReview) => { /* ... (保持不變) ... */ }, [editingReview, reviewPagination.currentPage, fetchReviews, loadReplies]);
    const handleCancelEdit = useCallback(() => { /* ... (保持不變) ... */ }, []);
    const handleDeleteReview = useCallback(async (id) => { /* ... (內部調用 fetchOwnedShopDetails 保持不變) ... */ }, [reviews, repliesMap, editingReview, replyingToReviewId, reviewPagination, fetchReviews, fetchOwnedShopDetails]);
    const handleEditReview = useCallback((r) => { /* ... (保持不變) ... */ }, [user?.id]);
    const handleReplyToReview = useCallback((pId) => { /* ... (保持不變) ... */ }, []);
    const handleReviewPageChange = (pN) => { /* ... (保持不變) ... */ };
    const handleSortChange = (e) => { /* ... (保持不變) ... */ };
    // --- ---

    // --- useEffect for initial data loading (修改權限檢查) ---
    useEffect(() => {
        // *** 修改權限檢查 ***
        if (!isAuthLoading && isAuthenticated && isShopOwner && ownedShopId) {
            console.log(`[MyOwnedShopPage] useEffect loading for owned shop ID: ${ownedShopId}`);
            // 重置狀態
            setShop(null); setReviews([]); setErrorShop(''); setErrorReviews(''); setIsLoadingShop(true); setIsLoadingReviews(false);
            setEditingReview(null); setReplyingToReviewId(null);
            setReviewPagination(prev => ({ ...prev, currentPage: 0, totalPages: 0, totalElements: 0 }));
            setReviewSortBy('createdAt'); setReviewSortDir('DESC');
            setRepliesMap({}); setLoadingRepliesMap({}); setExpandedRepliesMap({});

            const loadInitialData = async () => {
                setIsLoadingShop(true);
                try {
                    await fetchOwnedShopDetails();
                    await fetchReviews(0);
                } catch (error) { console.error("[MyOwnedShopPage] Error during initial data load:", error); }
                finally { setIsLoadingShop(false); }
            };
            loadInitialData();
        } else if (!isAuthLoading) {
             setIsLoadingShop(false); // 結束加載狀態
             // 設置錯誤信息 (使用 isShopOwner 判斷)
             if (!isAuthenticated) setErrorShop('請先登入。');
             else if (!isShopOwner) setErrorShop('只有店家用戶可以訪問此頁面。'); // <--- 這裡會設置錯誤
             else if (!ownedShopId) setErrorShop('無法找到您擁有的店家信息，請聯繫管理員。');
        }
        // *** --- ***
    }, [ownedShopId, isAuthenticated, isAuthLoading, isShopOwner, fetchOwnedShopDetails, fetchReviews]); // 添加 isShopOwner, fetchOwnedShopDetails, fetchReviews

    // --- 輔助函數 (保持不變) ---
    const renderMediaItem = (mediaItem, index) => { /* ... (保持不變) ... */ };
    // --- ---

    // --- 增加 Console Log 來診斷 user 物件 ---
    useEffect(() => {
      if (!isAuthLoading) {
        console.log('[MyOwnedShopPage] Auth Check State:', {
          isAuthenticated,
          isShopOwnerCalculated: isShopOwner,
          userObject: user // 打印完整的 user 對象
        });
      }
    }, [isAuthLoading, isAuthenticated, isShopOwner, user]);
    // --- ---

    // --- 主渲染邏輯 (修改權限檢查) ---
    if (isAuthLoading || isLoadingShop) {
        // 初始 Auth 加載或店家信息加載中
        return <div className="loading page-loading" style={{ paddingTop: '5rem' }}>載入店家管理頁面...</div>;
    }

    // *** 修改權限檢查，使用 isShopOwner ***
    // 這個檢查現在應該在 useEffect 中處理並設置 errorShop，理論上不會執行到這裡
    // 但作為保險，保留一個檢查
    if (!isAuthenticated || !isShopOwner) {
        console.error('[MyOwnedShopPage] Render Check Failed!', { isAuthenticated, isShopOwner });
        // 優先顯示 setErrorShop 設置的錯誤信息
        return <NotFoundPage message={errorShop || "只有店家用戶可以訪問此頁面。"} />;
    }
    // *** --- ***

    if (errorShop && !shop) { return <NotFoundPage message={errorShop} />; }
    if (!shop) { return <NotFoundPage message={errorShop || "無法載入您的店家資料，請確認帳號狀態或聯繫管理員。"} />; }
    // --- ---

    // --- 準備渲染數據 (保持不變) ---
    const shopLocation = shop.latitude && shop.longitude ? { lat: parseFloat(shop.latitude), lng: parseFloat(shop.longitude) } : null;
    const shopAvgRating = parseFloat(shop.averageRating) || 0;
    const shopMediaList = Array.isArray(shop.media) ? shop.media : [];
    // ** 修改這裡，使用 isShopOwner **
    const shopOwnerIdForCheck = isShopOwner ? user.id : null; // 確保是店家才取 id
    const currentSliderSettings = { ...sliderSettings, infinite: shopMediaList.length > 1, arrows: shopMediaList.length > 1 };
    // --- ---

    // --- JSX 渲染 (大部分保持不變，修改 ReviewCard 的權限傳遞) ---
    return (
        <div className="my-owned-shop-page shop-detail-page page-container">
            {/* 頁面標頭 */}
            <div className="page-header my-shop-header">
                <h1>我的店面管理：{shop.name}</h1>
                <button onClick={() => navigate(`/shops/${ownedShopId}/edit`)} className="edit-shop-button main-action-button">
                    編輯店家資訊
                </button>
            </div>

            {/* 主要內容網格 */}
            <div className="shop-content-grid">
                 <div className="shop-info"> {/* 左側 */}
                    {/* ... (媒體輪播, 基本信息, 平均評分 - 保持不變) ... */}
                 </div>
                 <div className="shop-map"> {/* 右側 */}
                    {/* ... (地圖邏輯 - 保持不變) ... */}
                 </div>
            </div>

            {/* 評論區 */}
            <div className="review-section shop-owner-reviews" ref={reviewSectionRef}>
                <h2>顧客評論與回覆 ({reviewPagination.totalElements})</h2>

                {/* 回覆/編輯表單區域 */}
                <div ref={reviewFormRef}>
                    {/* 編輯店家自己的回覆 */}
                    {editingReview && ( <AddReviewForm shopId={ownedShopId} reviewToEdit={editingReview} onReviewUpdated={handleReviewUpdated} onCancelEdit={handleCancelEdit} isReplyMode={true} /> )}
                    {/* 回覆顧客的頂級評論 */}
                    {replyingToReviewId && !editingReview && ( <AddReviewForm shopId={ownedShopId} isReplyMode={true} parentReviewId={replyingToReviewId} onReviewAdded={handleReviewAdded} onCancelEdit={handleCancelEdit} /> )}
                </div>

                {/* 評論排序 */}
                {/* ... (保持不變) ... */}

                {/* 評論列表 */}
                {isLoadingReviews && reviews.length === 0 && <div className="loading">載入評論中...</div>}
                {errorReviews && !isLoadingReviews && <div className="error">錯誤: {errorReviews}</div>}
                {!isLoadingReviews && !errorReviews && reviews.length === 0 && reviewPagination.totalElements === 0 && ( <div className="no-results">目前還沒有顧客評論。</div> )}
                <div className="review-list">
                    {Array.isArray(reviews) && reviews.map((review) => {
                      if (!review || !review.user) return null;
                      const reviewIdStr = String(review.id);
                      const currentReplies = repliesMap[reviewIdStr] || [];
                      const isLoadingCurrentReplies = loadingRepliesMap[reviewIdStr] || false;
                      const areRepliesExpanded = expandedRepliesMap[reviewIdStr] || false;
                      return (
                        <div key={review.id} className="review-item-container">
                            <ReviewCard
                              review={review} isReply={false}
                              // ** 傳遞計算好的 isShopOwner **
                              isShopOwnerViewing={isShopOwner} // 告訴卡片當前是否店家視角
                              shopOwnerId={shopOwnerIdForCheck} // 店家 ID (可能為 null)
                              currentUserId={user?.id} // 當前用戶 ID
                              onDelete={null} // 店家不能刪除顧客評論
                              onEdit={null} // 店家不能編輯顧客評論
                              onReply={isShopOwner ? handleReplyToReview : null} // 只有店家能回覆
                              onLoadReplies={loadReplies} isExpanded={areRepliesExpanded} replyCount={review.replyCount ?? 0} isLoadingReplies={isLoadingCurrentReplies}
                            />
                            {areRepliesExpanded && ( <div className="replies-list-container"> {isLoadingCurrentReplies ? ( <div className="loading">載入回覆中...</div> ) : ( currentReplies.length > 0 ? ( currentReplies.map(reply => { if (!reply || !reply.user) return null; const isEditingThisReply = editingReview?.id === reply.id; if (isEditingThisReply) return null; return ( <ReviewCard key={reply.id} review={reply} isReply={true} isShopOwnerViewing={isShopOwner} shopOwnerId={shopOwnerIdForCheck} currentUserId={user?.id} onDelete={reply.user?.id === user?.id ? handleDeleteReview : null} onEdit={reply.user?.id === user?.id ? handleEditReview : null} onReply={null} onLoadReplies={null} /> ); }) ) : ( <p className="no-replies">目前沒有回覆。</p> ) )} </div> )}
                        </div> ); })}
                </div>
                {/* 評論分頁 */}
                {/* ... (保持不變) ... */}
            </div>
        </div>
    );
};

export default MyOwnedShopPage;