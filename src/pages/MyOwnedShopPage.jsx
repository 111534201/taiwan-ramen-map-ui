// src/pages/MyOwnedShopPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // 引入 Link 和 useNavigate
import { GoogleMap, MarkerF as Marker } from '@react-google-maps/api';
import Slider from "react-slick";
import apiClient from '../services/api';
import  useAuth  from '../hooks/useAuth';
import { Role } from '../constants/roles';
import ReviewCard from '../components/ReviewCard';
import Pagination from '../components/Pagination';
import AddReviewForm from '../components/AddReviewForm';
import { renderStars } from '../utils/uiUtils';
import NotFoundPage from './NotFoundPage';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
// 引入共享的樣式
import './ShopDetailPage.css'; // 大部分樣式可以復用詳情頁的
import './MyOwnedShopPage.css'; // 可以添加一些頁面特定樣式

// --- 常量和輔助函數 ---
const mapContainerStyle = { width: '100%', height: '400px', borderRadius: '8px' };
const defaultMapOptions = { streetViewControl: false, mapTypeControl: false, fullscreenControl: false, zoomControl: true, gestureHandling: 'cooperative' };
const sliderSettings = { dots: true, infinite: false, speed: 500, slidesToShow: 1, slidesToScroll: 1, adaptiveHeight: true };
const buildMediaUrl = (relativePath) => { if (!relativePath) return '/placeholder-image.png'; if (relativePath.startsWith('http')) return relativePath; const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'; const uploadPath = '/uploads'; const cleanRelativePath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath; return `${baseUrl}${uploadPath}/${cleanRelativePath}`; };
// --- ---

const MyOwnedShopPage = ({ mapLoaded, mapLoadError }) => {
    const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const navigate = useNavigate();

    // --- State ---
    const [shop, setShop] = useState(null);
    const [isLoadingShop, setIsLoadingShop] = useState(true);
    const [errorShop, setErrorShop] = useState('');
    const [reviews, setReviews] = useState([]);
    const [isLoadingReviews, setIsLoadingReviews] = useState(false);
    const [errorReviews, setErrorReviews] = useState('');
    const [reviewPagination, setReviewPagination] = useState({ currentPage: 0, totalPages: 0, pageSize: 5, totalElements: 0 });
    const [reviewSortBy, setReviewSortBy] = useState('createdAt');
    const [reviewSortDir, setReviewSortDir] = useState('DESC');
    const [editingReview, setEditingReview] = useState(null); // 編輯店家自己的回覆
    const [replyingToReviewId, setReplyingToReviewId] = useState(null); // 正在回覆的顧客評論ID
    const [repliesMap, setRepliesMap] = useState({});
    const [loadingRepliesMap, setLoadingRepliesMap] = useState({});
    const [expandedRepliesMap, setExpandedRepliesMap] = useState({});

    // --- Refs ---
    const reviewSectionRef = useRef(null);
    const reviewFormRef = useRef(null);

    // --- 獲取店家用戶擁有的店家 ID ---
    const ownedShopId = React.useMemo(() => {
        if (user && user.role === Role.ROLE_SHOP_OWNER && Array.isArray(user.ownedShopIds) && user.ownedShopIds.length > 0) {
            return user.ownedShopIds[0]; // 取第一個
        }
        else if (user && user.role === Role.ROLE_SHOP_OWNER && user.ownedShopId) { // 兼容舊屬性
             return user.ownedShopId;
         }
        return null;
    }, [user]); // 依賴 user 對象

    // --- 回調函數 ---
     const fetchOwnedShopDetails = useCallback(async () => {
         if (isAuthLoading || !isAuthenticated || user?.role !== Role.ROLE_SHOP_OWNER || !ownedShopId) {
             setIsLoadingShop(false);
             if (!isAuthLoading && (!isAuthenticated || user?.role !== Role.ROLE_SHOP_OWNER)) { setErrorShop('只有店家用戶可以訪問此頁面。'); }
             else if (!isAuthLoading && !ownedShopId) { setErrorShop('無法找到您擁有的店家信息，請聯繫管理員。'); }
             return Promise.reject('條件不滿足，無法獲取店家信息'); // 返回一個 rejected Promise
         }
         setIsLoadingShop(true); setErrorShop(''); setShop(null);
         try {
             const response = await apiClient.get(`/shops/${ownedShopId}`);
             if (response.data?.success && response.data?.data) {
                setShop(response.data.data);
                return response.data.data; // 返回獲取到的數據
             } else {
                throw new Error(response.data?.message || `無法獲取您的店家信息`);
             }
         } catch (err) {
            console.error("[MyOwnedShopPage] Fetch error:", err);
            setErrorShop(err?.response?.data?.message || err?.message || '無法載入店家信息');
            setShop(null);
            throw err; // 重新拋出錯誤，以便調用者知道失敗了
         } finally {
            // 這裡不設置 setIsLoadingShop(false)，讓調用者在 Promise 完成後處理
         }
     }, [ownedShopId, isAuthenticated, isAuthLoading, user?.role]);

    const fetchReviews = useCallback(async (page) => {
        if (!ownedShopId) return;
        setIsLoadingReviews(true);
        setErrorReviews('');
        const safePage = Math.max(0, page);
        try {
            const params = { page: safePage, size: reviewPagination.pageSize, sortBy: reviewSortBy, sortDir: reviewSortDir };
            const response = await apiClient.get(`/reviews/shop/${ownedShopId}`, { params });
            if (response.data?.success && response.data?.data) {
                const d = response.data.data;
                setReviews(Array.isArray(d.content) ? d.content : []);
                setReviewPagination(p => ({ ...p, currentPage: d.pageNo ?? 0, totalPages: d.totalPages ?? 0, totalElements: d.totalElements ?? 0 }));
            } else {
                throw new Error(response.data?.message || '無法獲取評論');
            }
        } catch (err) {
            console.error("[fetchReviews] Error:", err);
            setErrorReviews(err?.response?.data?.message || err?.message || '無法載入評論');
            setReviews([]);
        } finally {
            setIsLoadingReviews(false);
        }
    }, [ownedShopId, reviewPagination.pageSize, reviewSortBy, reviewSortDir]);

    const loadReplies = useCallback(async (pId) => {
        const idStr = String(pId);
        const isExp = expandedRepliesMap[idStr];
        const isLd = loadingRepliesMap[idStr];
        const aldLd = !!repliesMap[idStr]; // already loaded
        setExpandedRepliesMap(p => ({ ...p, [idStr]: !isExp })); // Toggle expansion state

        // Only load if expanding, not already loaded, and not currently loading
        if (!isExp && !aldLd && !isLd) {
            setLoadingRepliesMap(p => ({ ...p, [idStr]: true }));
            try {
                const res = await apiClient.get(`/reviews/${pId}/replies`);
                if (res.data?.success && Array.isArray(res.data.data)) {
                    setRepliesMap(p => ({ ...p, [idStr]: res.data.data }));
                } else {
                    throw new Error(res.data?.message || '無法獲取回覆');
                }
            } catch (e) {
                console.error(`[loadReplies for ${pId}] Error:`, e);
                setRepliesMap(p => ({ ...p, [idStr]: [] })); // Set empty array on error to avoid re-fetching constantly
            } finally {
                setLoadingRepliesMap(p => ({ ...p, [idStr]: false }));
            }
        }
    }, [expandedRepliesMap, loadingRepliesMap, repliesMap]); // Dependencies

    const scrollToElement = (ref) => { if (ref.current) { ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); } };

    const handleReviewAdded = useCallback((addedReview) => {
        const pId = replyingToReviewId;
        setReplyingToReviewId(null);
        setEditingReview(null);
        // 店家回覆不影響評分，不需要 fetchOwnedShopDetails
        if (!pId) { // 正常情況下店家不能添加頂級評論，但以防萬一
            fetchReviews(0);
        } else {
            // 清除舊的 replies 數據強制重新加載
            setRepliesMap(prev => { const newState = { ...prev }; delete newState[String(pId)]; return newState; });
            setExpandedRepliesMap(prev => ({ ...prev, [String(pId)]: true })); // 確保回覆展開
            loadReplies(pId); // 重新加載該評論的回覆
            // 更新頂級評論列表中的回覆數 (如果 API 返回了更新後的 replyCount)
            setReviews(prevReviews => prevReviews.map(r => r.id === pId ? { ...r, replyCount: (r.replyCount ?? 0) + 1 } : r));
            // fetchReviews(reviewPagination.currentPage); // 可能不需要，除非後端刪除/添加會影響分頁
        }
    }, [replyingToReviewId, fetchReviews, loadReplies, reviewPagination.currentPage]); // 移除 fetchOwnedShopDetails

    const handleReviewUpdated = useCallback((updatedReview) => {
        const parentId = updatedReview?.parentReviewId;
        setEditingReview(null);
        // 店家編輯回覆不影響評分，不需要 fetchOwnedShopDetails
        if (!parentId) { // 正常情況下店家不能編輯頂級評論
             fetchReviews(reviewPagination.currentPage);
        } else {
             // 清除舊的 replies 數據強制重新加載
            setRepliesMap(prev => { const newState = { ...prev }; delete newState[String(parentId)]; return newState; });
            setExpandedRepliesMap(prev => ({ ...prev, [String(parentId)]: true })); // 確保回覆展開
            loadReplies(parentId); // 重新加載該評論的回覆
            // fetchReviews(reviewPagination.currentPage); // 可能不需要
        }
    }, [editingReview, reviewPagination.currentPage, fetchReviews, loadReplies]); // 移除 fetchOwnedShopDetails

    const handleCancelEdit = useCallback(() => { setEditingReview(null); setReplyingToReviewId(null); }, []);

    // --- 修正點：將 fetchShopDetails 改為 fetchOwnedShopDetails ---
    const handleDeleteReview = useCallback(async (id) => {
        if (!id || !window.confirm('確定刪除此評論或回覆嗎？')) return;
        try {
            let pId = null; // 檢查刪除的是頂級評論還是回覆
            const topLevelReview = reviews.find(r => r?.id === id);

            if (!topLevelReview) { // 如果不是頂級評論，則在回覆中查找
                for (const parentId in repliesMap) {
                    const reply = repliesMap[parentId]?.find(rp => rp?.id === id);
                    if (reply) {
                        pId = reply.parentReviewId; // 找到了，記錄其父評論 ID
                        break;
                    }
                }
            }

            await apiClient.delete(`/reviews/${id}`);
            alert('刪除成功');

            // 清理狀態
            if (editingReview?.id === id) setEditingReview(null);
            if (replyingToReviewId === id) setReplyingToReviewId(null); // 這個應該不會發生，因為店家不能回覆自己的評論

            if (!pId) { // --- 刪除的是頂級評論 ---
                // 只有刪除頂級評論才可能影響店家的平均評分，所以重新獲取店家信息
                fetchOwnedShopDetails().catch(e => console.error("重新獲取店家信息失敗 after delete:", e)); // --- 使用正確的函數名 ---

                // 清除此評論的回覆 (如果已加載) 和展開狀態
                setRepliesMap(p => { const n = { ...p }; delete n[String(id)]; return n; });
                setExpandedRepliesMap(p => { const n = { ...p }; delete n[String(id)]; return n; });

                // 重新計算分頁並獲取評論
                const { totalElements: pTE, pageSize: pS, currentPage: pC } = reviewPagination;
                const nTE = Math.max(0, pTE - 1); // 總數減一
                const nTP = Math.ceil(nTE / pS); // 新的總頁數
                let pageToFetch = pC;
                // 如果當前頁是最後一頁且刪除後變空了，跳轉到前一頁
                if (pageToFetch > 0 && pageToFetch >= nTP) {
                    pageToFetch = Math.max(0, nTP - 1);
                }
                fetchReviews(pageToFetch);

            } else { // --- 刪除的是回覆 ---
                // 從 repliesMap 中移除該回覆
                setRepliesMap(p => {
                    const n = { ...p };
                    const ps = String(pId);
                    if (n[ps]) {
                        n[ps] = n[ps].filter(rp => rp?.id !== id);
                    }
                    return n;
                });
                // 更新對應頂級評論的回覆數
                setReviews(prevReviews => prevReviews.map(r => r.id === pId ? { ...r, replyCount: Math.max(0, (r.replyCount ?? 0) - 1) } : r));
                // 通常不需要重新 fetchReviews 整個列表，除非有特殊需求
                 // fetchReviews(reviewPagination.currentPage);
            }
        } catch (e) {
            console.error("刪除失敗:", e);
            alert(`刪除失敗: ${e?.response?.data?.message || e?.message}`);
        }
    }, [reviews, repliesMap, editingReview, replyingToReviewId, reviewPagination, fetchReviews, fetchOwnedShopDetails]); // --- 使用正確的函數名 ---

    const handleEditReview = useCallback((r) => {
        // 店家只能編輯自己的回覆 (假設 user.id 是 owner id)
        if(r?.user?.id === user?.id) {
            setReplyingToReviewId(null); // 清除可能存在的回覆狀態
            setEditingReview(r);
            setTimeout(() => scrollToElement(reviewFormRef), 100); // 延遲滾動，確保表單渲染
        } else {
            alert("您只能編輯自己的回覆。");
        }
    }, [user?.id]); // 依賴 user id

    const handleReplyToReview = useCallback((pId) => {
        setEditingReview(null); // 清除可能存在的編輯狀態
        setReplyingToReviewId(pId);
        setTimeout(() => scrollToElement(reviewFormRef), 100);
    }, []);

    const handleReviewPageChange = (pN) => {
        const safePageNumber = Math.max(0, pN);
        if (safePageNumber !== reviewPagination.currentPage) {
            fetchReviews(safePageNumber);
            scrollToElement(reviewSectionRef); // 滾動到評論區頂部
        }
    };

    const handleSortChange = (e) => {
        const selectedValue = e.target.value;
        let newSortBy = 'createdAt';
        let newSortDir = 'DESC';
        if (selectedValue === 'rating_desc') {
            newSortBy = 'rating';
            newSortDir = 'DESC';
        } else if (selectedValue === 'rating_asc') {
            newSortBy = 'rating';
            newSortDir = 'ASC';
        }
        // 只有當排序條件改變時才重新獲取
        if (newSortBy !== reviewSortBy || newSortDir !== reviewSortDir) {
            setReviewSortBy(newSortBy);
            setReviewSortDir(newSortDir);
            fetchReviews(0); // 排序改變，回到第一頁
        }
    };
    // --- ---

    // --- useEffect for initial data loading ---
    useEffect(() => {
        // 等待 Auth 狀態確定並且獲取到 ownedShopId 後再加載
        if (!isAuthLoading && isAuthenticated && user?.role === Role.ROLE_SHOP_OWNER && ownedShopId) {
            console.log(`[MyOwnedShopPage] useEffect loading for owned shop ID: ${ownedShopId}`);
            // 重置所有相關狀態
            setShop(null); setReviews([]); setErrorShop(''); setErrorReviews(''); setIsLoadingShop(true); setIsLoadingReviews(false);
            setEditingReview(null); setReplyingToReviewId(null);
            setReviewPagination(prev => ({ ...prev, currentPage: 0, totalPages: 0, totalElements: 0 }));
            setReviewSortBy('createdAt'); setReviewSortDir('DESC');
            setRepliesMap({}); setLoadingRepliesMap({}); setExpandedRepliesMap({});

            const loadInitialData = async () => {
                setIsLoadingShop(true); // 確保開始時是加載狀態
                try {
                    await fetchOwnedShopDetails(); // 先獲取店家信息
                    // 獲取店家成功後才獲取評論
                    await fetchReviews(0);
                } catch (error) {
                    console.error("[MyOwnedShopPage] Error during initial data load:", error);
                    // 如果 fetchOwnedShopDetails 失敗，錯誤已在該函數中設置 (setErrorShop)
                    // 如果 fetchReviews 失敗，錯誤已在該函數中設置 (setErrorReviews)
                } finally {
                    setIsLoadingShop(false); // 無論成功或失敗，結束加載狀態
                }
            };
            loadInitialData();
        } else if (!isAuthLoading) {
             // Auth 加載完畢，但不滿足條件 (未登入、非店家、無 ownedShopId)
             setIsLoadingShop(false); // 結束加載狀態
             // 錯誤信息會在 fetchOwnedShopDetails 的檢查中設置，或者在渲染邏輯中處理
             if (!isAuthenticated) setErrorShop('請先登入。');
             else if (user?.role !== Role.ROLE_SHOP_OWNER) setErrorShop('只有店家用戶可以訪問此頁面。');
             else if (!ownedShopId) setErrorShop('無法找到您擁有的店家信息，請聯繫管理員。');
        }
        // 注意：不要將 fetchOwnedShopDetails 和 fetchReviews 直接放在依賴數組中，
        // 因為它們是 useCallback 創建的，可能導致不必要的重渲染。
        // 我們依賴的是觸發它們執行的條件：ownedShopId, isAuthenticated, isAuthLoading, user?.role
    }, [ownedShopId, isAuthenticated, isAuthLoading, user?.role]); // 依賴項應為觸發條件

    // --- 輔助函數：渲染媒體 ---
    const renderMediaItem = (mediaItem, index) => {
        if (!mediaItem || !mediaItem.filePath) {
            return ( <div key={`placeholder-${index}`} className="shop-media-item placeholder"><span className="placeholder-text">媒體無效</span></div> );
        }
        const url = buildMediaUrl(mediaItem.filePath);
        const type = mediaItem.mediaType || 'IMAGE'; // 假設默認是圖片

        if (type === 'VIDEO') {
            return ( <div key={mediaItem.id || index} className="shop-media-item video-item"> <video controls src={url}><a href={url} target="_blank" rel="noopener noreferrer">觀看影片</a></video> </div> );
        } else { // IMAGE or unknown
            return ( <div key={mediaItem.id || index} className="shop-media-item image-item"> <img src={url} alt={`店家照片 ${index + 1}`} loading="lazy" onError={(e) => e.target.src = '/placeholder-image.png'} /> </div> );
        }
    };

    // --- 輔助函數：格式化日期 ---
    const formatDateTime = (dateTimeString) => {
        if (!dateTimeString) return '未知';
        try {
            return format(new Date(dateTimeString), 'yyyy年MM月dd日 HH:mm', { locale: zhTW });
        } catch (e) {
            console.warn("日期格式化錯誤:", dateTimeString, e);
            return dateTimeString; // fallback
        }
    };
    // --- ---

    // --- 主渲染邏輯 ---
    if (isAuthLoading || isLoadingShop) {
        // 在 Auth 加載中或初始店家信息加載中顯示全頁 Loading
        return <div className="loading page-loading" style={{ paddingTop: '5rem' }}>載入店家管理頁面...</div>;
    }

    // --- 權限不足或獲取店家信息失敗的處理 ---
    if (!isAuthenticated || user?.role !== Role.ROLE_SHOP_OWNER) {
        // 確保用戶已登入且是店家角色 (雖然應該被 ProtectedRoute 擋住，但多一層保險)
        return <NotFoundPage message={errorShop || "只有店家用戶可以訪問此頁面。"} />;
    }
    if (errorShop && !shop) {
        // 如果有獲取店家信息的錯誤，且沒有店家數據，顯示錯誤頁面
        return <NotFoundPage message={errorShop} />;
    }
    if (!shop) {
         // 沒有錯誤信息，但仍然沒有店家數據 (例如 ownedShopId 無效但 API 沒報錯)
         return <NotFoundPage message={errorShop || "無法載入您的店家資料，請確認帳號狀態或聯繫管理員。"} />;
    }
    // --- ---

    // --- 準備渲染數據 (確保 shop 存在後再讀取屬性) ---
    const shopLocation = shop.latitude && shop.longitude ? { lat: parseFloat(shop.latitude), lng: parseFloat(shop.longitude) } : null;
    const shopAvgRating = parseFloat(shop.averageRating) || 0;
    const shopMediaList = Array.isArray(shop.media) ? shop.media : [];
    const shopOwnerIdForCheck = shop.owner?.id; // 這個應該就是 user.id
    const currentSliderSettings = { ...sliderSettings, infinite: shopMediaList.length > 1, arrows: shopMediaList.length > 1 };
    // --- ---

    // --- JSX 渲染 ---
    return (
        <div className="my-owned-shop-page shop-detail-page page-container"> {/* 復用詳情頁樣式 */}
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
                    {/* 媒體輪播 */}
                    {shopMediaList.length > 0 ? (
                        <div className="shop-media-carousel-container">
                            <Slider {...currentSliderSettings}>
                                {shopMediaList.map(renderMediaItem)}
                            </Slider>
                        </div>
                     ) : (
                         <div className="shop-media-carousel-container placeholder">
                             <span className="placeholder-text">店家尚未上傳圖片或影片</span>
                         </div>
                     )}

                    {/* 店家基本信息 */}
                    <p><strong>地址:</strong> {shop.address || '未提供'}</p>
                    {shop.phone && <p><strong>電話:</strong> <a href={`tel:${shop.phone}`}>{shop.phone}</a></p>}
                    {shop.openingHours && ( <div className="shop-info-block"><strong>營業時間:</strong><pre>{shop.openingHours}</pre></div> )}
                    {shop.description && ( <div className="shop-info-block"><strong>特色描述:</strong><pre>{shop.description}</pre></div> )}
                    <p><small>最後更新於: {formatDateTime(shop.updatedAt)}</small></p>

                    {/* 店家平均評分 - 在店家管理頁也可顯示 */}
                    <div className="shop-rating-summary">
                        <strong>平均評分: </strong>
                        {shopAvgRating > 0 ? (
                            <>
                                {renderStars(shopAvgRating)}
                                <span className="rating-value"> {shopAvgRating.toFixed(1)} / 5</span>
                                <span className="rating-count"> ({shop.reviewCount || 0} 則評論)</span>
                            </>
                        ) : (
                            <span> 尚無評分</span>
                        )}
                    </div>
                </div>
                <div className="shop-map"> {/* 右側 */}
                    {mapLoadError ? ( <div className="map-placeholder error-message">地圖載入失敗: {mapLoadError.message}</div> )
                     : !mapLoaded ? ( <div className="map-placeholder">地圖載入中...</div> )
                     : shopLocation ? (
                        <GoogleMap
                            mapContainerStyle={mapContainerStyle}
                            center={shopLocation}
                            zoom={16}
                            options={defaultMapOptions}
                        >
                            <Marker position={shopLocation} title={shop.name} />
                        </GoogleMap>
                       )
                     : ( <div className="map-placeholder">店家未提供座標。</div> )}
                </div>
            </div>

            {/* 評論區 */}
            <div className="review-section shop-owner-reviews" ref={reviewSectionRef}>
                <h2>顧客評論與回覆 ({reviewPagination.totalElements})</h2>

                {/* 回覆/編輯表單區域 */}
                <div ref={reviewFormRef}>
                    {/* 編輯店家自己的回覆 */}
                    {editingReview && (
                        <AddReviewForm
                            shopId={ownedShopId}
                            reviewToEdit={editingReview}
                            onReviewUpdated={handleReviewUpdated}
                            onCancelEdit={handleCancelEdit}
                            isReplyMode={true} // 編輯的也是回覆
                        />
                    )}
                    {/* 回覆顧客的頂級評論 */}
                    {replyingToReviewId && !editingReview && (
                        <AddReviewForm
                            shopId={ownedShopId}
                            isReplyMode={true}
                            parentReviewId={replyingToReviewId}
                            onReviewAdded={handleReviewAdded}
                            onCancelEdit={handleCancelEdit}
                        />
                    )}
                    {/* 店家不能發表新的"頂級"評論，所以不顯示那個表單 */}
                </div>

                {/* 評論排序 */}
                {(reviewPagination.totalElements > 0 || isLoadingReviews) && (
                    <div className="review-controls">
                        <div className="review-sort-controls">
                            <label htmlFor="review-sort">排序: </label>
                            <select
                                id="review-sort"
                                value={reviewSortBy === 'createdAt' ? 'createdAt_desc' : (reviewSortDir === 'DESC' ? 'rating_desc' : 'rating_asc')}
                                onChange={handleSortChange}
                                disabled={isLoadingReviews}
                            >
                                <option value="createdAt_desc">最新</option>
                                <option value="rating_desc">評分高到低</option>
                                <option value="rating_asc">評分低到高</option>
                            </select>
                        </div>
                    </div>
                )}
                {/* 評論列表 */}
                {isLoadingReviews && reviews.length === 0 && <div className="loading">載入評論中...</div>}
                {errorReviews && !isLoadingReviews && <div className="error">錯誤: {errorReviews}</div>}
                {!isLoadingReviews && !errorReviews && reviews.length === 0 && reviewPagination.totalElements === 0 && (
                    <div className="no-results">目前還沒有顧客評論。</div>
                )}
                <div className="review-list">
                    {Array.isArray(reviews) && reviews.map((review) => {
                      if (!review || !review.user) return null; // 基本的數據檢查
                      const reviewIdStr = String(review.id);
                      const isEditingThisTopLevel = editingReview?.id === review.id && !editingReview?.parentReviewId; // 檢查是否正在編輯這個頂級評論 (店家不該能編輯)
                      const currentReplies = repliesMap[reviewIdStr] || [];
                      const isLoadingCurrentReplies = loadingRepliesMap[reviewIdStr] || false;
                      const areRepliesExpanded = expandedRepliesMap[reviewIdStr] || false;

                      // 如果正在編輯這個頂級評論，不渲染它（因為表單在上面）-- 店家不該發生
                      if (isEditingThisTopLevel) return null;

                      return (
                        <div key={review.id} className="review-item-container">
                            {/* 渲染頂級評論 */}
                            <ReviewCard
                              review={review}
                              isReply={false}
                              shopOwnerId={shopOwnerIdForCheck} // 用於判斷是否顯示 "店家" 標籤
                              currentUserId={user?.id} // 用於控制按鈕權限 (雖然店家不能編輯/刪除顧客評論)
                              onDelete={null} // 店家不能刪除顧客評論 (除非是 Admin)
                              onEdit={null}   // 店家不能編輯顧客評論
                              onReply={handleReplyToReview} // 店家可以回覆
                              onLoadReplies={loadReplies}
                              isExpanded={areRepliesExpanded}
                              replyCount={review.replyCount ?? 0}
                              isLoadingReplies={isLoadingCurrentReplies}
                            />
                            {/* 渲染回覆列表 (如果展開) */}
                            {areRepliesExpanded && (
                              <div className="replies-list-container">
                                {isLoadingCurrentReplies ? (
                                  <div className="loading">載入回覆中...</div>
                                ) : (
                                  currentReplies.length > 0 ? (
                                    currentReplies.map(reply => {
                                      if (!reply || !reply.user) return null;
                                      const isEditingThisReply = editingReview?.id === reply.id;
                                      // 如果正在編輯此回覆，則不渲染卡片 (表單在上方顯示)
                                      if (isEditingThisReply) return null;
                                      return (
                                        <ReviewCard
                                          key={reply.id}
                                          review={reply}
                                          isReply={true}
                                          shopOwnerId={shopOwnerIdForCheck}
                                          currentUserId={user?.id}
                                          // 店家可以刪除/編輯自己的回覆
                                          onDelete={reply.user?.id === user?.id ? handleDeleteReview : null}
                                          onEdit={reply.user?.id === user?.id ? handleEditReview : null}
                                          onReply={null} // 不能回覆回覆
                                          onLoadReplies={null}
                                        />
                                      );
                                    })
                                  ) : (
                                    <p className="no-replies">目前沒有回覆。</p>
                                  )
                                )}
                              </div>
                            )}
                        </div>
                      );
                    })}
                </div>
                {/* 評論分頁 */}
                {!isLoadingReviews && !errorReviews && reviewPagination.totalPages > 1 && (
                    <div className="pagination-container">
                        <Pagination
                            currentPage={reviewPagination.currentPage}
                            totalPages={reviewPagination.totalPages}
                            onPageChange={handleReviewPageChange}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyOwnedShopPage;