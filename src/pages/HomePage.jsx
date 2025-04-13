// src/pages/HomePage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // 根據您選擇的方法決定是否需要 Link 或 useNavigate
import { GoogleMap, MarkerF as Marker, InfoWindow, Autocomplete } from '@react-google-maps/api';
import apiClient from '../services/api';
import './HomePage.css';

// --- 常量定義 (保持不變) ---
const containerStyle = { width: '100%', height: 'calc(100vh - 60px)', minHeight: '400px' };
const center = { lat: 23.6978, lng: 120.9605 };
const defaultMapOptions = { streetViewControl: false, mapTypeControl: false, fullscreenControl: true, zoomControl: true, gestureHandling: 'cooperative' };
// --- ---

// --- 輔助函數：構建媒體 URL (保持不變) ---
const buildMediaUrl = (relativePath) => { /* ... (保持不變) ... */ };
// --- ---

const HomePage = ({ mapLoaded, mapLoadError }) => {
  const mapRef = useRef(null);
  const [shops, setShops] = useState([]);
  const [loadingMapData, setLoadingMapData] = useState(false);
  const [errorMapData, setErrorMapData] = useState(null);
  // 恢復 selectedShop (如果選擇方法二：InfoWindow)
  const [selectedShop, setSelectedShop] = useState(null);
  const autocompleteRef = useRef(null);
  const navigate = useNavigate(); // 保持導入 useNavigate (如果選擇方法一：直接跳轉)

  console.log('--- HomePage Component File Loaded ---'); // <--- 文件加載日誌

  // --- 地圖加載回調 ---
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    console.log("[HomePage] Map loaded.");
    const bounds = map.getBounds();
    if (bounds) {
      fetchShopsInBounds(bounds);
    } else {
      if (window.google && window.google.maps && window.google.maps.event) {
          const listener = google.maps.event.addListener(map, 'bounds_changed', () => {
              const bounds2 = map.getBounds();
              if (bounds2) {
                  console.log("[HomePage] Map bounds available after bounds_changed event.");
                  fetchShopsInBounds(bounds2);
                  google.maps.event.removeListener(listener);
              }
          });
      } else {
          console.error("Google Maps Event API not available for bounds_changed listener.");
      }
    }
  }, []); // 移除 fetchShopsInBounds 依賴

  // --- 地圖卸載回調 ---
  const onMapUnmount = useCallback(() => { mapRef.current = null; console.log("[HomePage] Map unmounted."); }, []);

  // --- 獲取範圍內店家 ---
  const fetchShopsInBounds = useCallback(async (bounds) => {
    if (!bounds) { console.log('[fetchShopsInBounds] Skipped: No bounds provided.'); return; }
    setLoadingMapData(true);
    setErrorMapData(null);
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    if (!ne || !sw) { console.warn('[fetchShopsInBounds] Invalid bounds object:', bounds); setLoadingMapData(false); return; }
    const params = { minLat: sw.lat(), maxLat: ne.lat(), minLng: sw.lng(), maxLng: ne.lng() };
    console.log("[HomePage] Fetching shops in bounds:", params);
    try {
      const response = await apiClient.get('/shops', { params });
      console.log("[HomePage] fetchShopsInBounds API Response:", response.data); // <-- 查看 API 原始響應
      if (response.data?.success && Array.isArray(response.data.data)) {
        console.log('[HomePage] fetchShopsInBounds Success - Raw shops data:', response.data.data);
        setShops(response.data.data); // <--- 更新 shops state
        console.log(`[HomePage] fetchShopsInBounds - Set ${response.data.data.length} shops to state.`);
      } else {
        console.error('[HomePage] fetchShopsInBounds - API success=false or data is not an array:', response.data);
        setShops([]); // 清空
        throw new Error(response.data?.message || "無法獲取店家");
      }
    } catch (err) {
      console.error("[HomePage] fetchShopsInBounds Error fetching shops:", err);
      setErrorMapData(err?.response?.data?.message || err?.data?.message || err?.message || '無法載入店家');
      setShops([]); // 清空
    } finally {
      setLoadingMapData(false);
    }
  }, []); // 依賴為空

  // --- 地圖空閒回調 ---
  const handleMapIdle = useCallback(() => {
    console.log("[HomePage] Map idle.");
    if (mapRef.current) {
      const bounds = mapRef.current.getBounds();
      if (bounds) {
        console.log("[HomePage] Bounds on idle:", bounds.toJSON());
        fetchShopsInBounds(bounds);
      } else {
        console.warn("[HomePage] No bounds on idle.");
      }
    }
  }, [fetchShopsInBounds]);

  // --- Marker 點擊處理 (根據您選擇的方法調整) ---

  // 方法一：直接跳轉
  // const handleMarkerClick = (shop) => {
  //   if (!shop || !shop.id) return;
  //   console.log(`[HomePage] Marker Clicked - Navigating to shop: ${shop.id}`);
  //   navigate(`/shops/${shop.id}`);
  // };

  // 方法二：設置 selectedShop 以顯示 InfoWindow
   const handleMarkerClick = (shop) => {
     console.log("[HomePage] Marker Clicked - Setting selectedShop:", shop);
     setSelectedShop(shop);
     // 可選：移動地圖中心
     if (mapRef.current && shop?.latitude && shop?.longitude) {
       const lat = parseFloat(shop.latitude);
       const lng = parseFloat(shop.longitude);
       if (!isNaN(lat) && !isNaN(lng)) { mapRef.current.panTo({ lat, lng }); }
     }
   };
   const handleInfoWindowClose = () => { setSelectedShop(null); };

  // --- 自動完成相關回調 (保持不變) ---
  const onAutocompleteLoad = useCallback((ac) => { autocompleteRef.current = ac; console.log("[HomePage] Autocomplete loaded."); }, []);
  const onPlaceChanged = useCallback(() => { /* ... (保持不變) ... */ }, [fetchShopsInBounds]);
  // --- ---

  // --- 渲染邏輯 ---
  if (mapLoadError) { return ( <div className="homepage"><div className="loading-message error-message">地圖資源載入失敗: {mapLoadError.message}</div></div> ); }
  if (!mapLoaded) { return ( <div className="homepage"><div className="loading-message">地圖資源初始化中...</div></div> ); }

  // *** 添加渲染前的日誌 ***
  console.log('[HomePage] Rendering with shops state:', shops);

  return (
    <div className="homepage">
      {/* 搜索框 (保持不變) */}
      <div className="map-search-container">
        <Autocomplete onLoad={onAutocompleteLoad} onPlaceChanged={onPlaceChanged} options={{ componentRestrictions:{country:'tw'} }} fields={["geometry","name","formatted_address"]}>
          <input type="text" placeholder="搜尋地點、地址或拉麵店名..." className="map-search-input" onKeyDown={(e)=>{if(e.key==='Enter')e.preventDefault();}}/>
        </Autocomplete>
      </div>

      {/* 加載/錯誤提示 (保持不變) */}
      {loadingMapData && <div className="loading-overlay map-loading">載入店家標記中...</div>}
      {errorMapData && <div className="error-overlay map-error">錯誤: {errorMapData}</div>}

      {/* Google Map */}
      <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={8}
          options={defaultMapOptions}
          onLoad={onMapLoad}
          onUnmount={onMapUnmount}
          onIdle={handleMapIdle}
          onClick={handleInfoWindowClose} // 如果使用方法二
      >
        {/* Markers */}
        {shops.map((shop, index) => { // 添加 index
          console.log(`[HomePage] Mapping shop #${index} for Marker:`, shop); // <-- 日誌 1
          const lat = parseFloat(shop?.latitude);
          const lng = parseFloat(shop?.longitude);
          console.log(`[HomePage] Parsed Lat/Lng for shop ${shop?.id} (index ${index}):`, { lat, lng, isLatNaN: isNaN(lat), isLngNaN: isNaN(lng) }); // <-- 日誌 2

          // 條件判斷
          return shop && shop.id && !isNaN(lat) && !isNaN(lng) ? (
            <Marker
                key={`shop-${shop.id}`} // 使用唯一的 ID 作為 key
                position={{ lat, lng }}
                title={shop.name}
                onClick={() => handleMarkerClick(shop)} // 調用對應的方法
            />
          ) : (
            // 添加一個日誌來記錄為什麼 Marker 沒有被渲染
            () => { console.warn(`[HomePage] Marker not rendered for shop index ${index} due to invalid data or coordinates.`, shop); return null; }
          )(); // 立即調用函數返回 null
        })}

        {/* InfoWindow (如果選擇方法二) */}
        {selectedShop && !isNaN(parseFloat(selectedShop.latitude)) && !isNaN(parseFloat(selectedShop.longitude)) && (
          <InfoWindow
            position={{ lat: parseFloat(selectedShop.latitude), lng: parseFloat(selectedShop.longitude) }}
            onCloseClick={handleInfoWindowClose}
            options={{ pixelOffset: new window.google.maps.Size(0, -35) }}
          >
             <div className="info-window-content">
              <h4>{selectedShop.name || 'N/A'}</h4>
              <p>{selectedShop.address || 'N/A'}</p>
              <p className="info-window-rating">
                 評分: {selectedShop.averageRating ? parseFloat(selectedShop.averageRating).toFixed(1) : 'N/A'} / 5
                 ({selectedShop.reviewCount || 0} 則)
              </p>
              <Link to={`/shops/${selectedShop.id}`} className="info-window-link">
                  查看詳情 →
              </Link>
            </div>
          </InfoWindow>
        )}

      </GoogleMap>
    </div>
  );
};

export default HomePage;