// src/pages/HomePage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, MarkerF as Marker, InfoWindow, Autocomplete } from '@react-google-maps/api'; // 確保導入
import apiClient from '../services/api';
import { Link } from 'react-router-dom';
import { format } from 'date-fns'; // 如果 InfoWindow 想顯示時間
import { zhTW } from 'date-fns/locale';
import './HomePage.css'; // 確保引入樣式

// --- 常量定義 ---
const containerStyle = {
  width: '100%',
  height: 'calc(100vh - 60px)', // 假設 Navbar 高 60px
  minHeight: '400px',
};
const center = { lat: 23.6978, lng: 120.9605 }; // 台灣中心
const defaultMapOptions = {
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: true,
    zoomControl: true,
    gestureHandling: 'cooperative',
    // mapId: import.meta.env.VITE_GOOGLE_MAPS_ID, // 可選：自定義地圖樣式 ID
};
// --- ---

// --- 輔助函數：構建媒體 URL (如果 InfoWindow 需要顯示圖片) ---
const buildMediaUrl = (relativePath) => {
    if (!relativePath) return '/placeholder-image.png';
    if (relativePath.startsWith('http')) return relativePath;
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
    const uploadPath = '/uploads';
    const cleanRelativePath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    return `${baseUrl}${uploadPath}/${cleanRelativePath}`;
};
// --- ---


const HomePage = ({ mapLoaded, mapLoadError }) => {
  const mapRef = useRef(null);
  const [shops, setShops] = useState([]);
  const [loadingMapData, setLoadingMapData] = useState(false);
  const [errorMapData, setErrorMapData] = useState(null);
  const [selectedShop, setSelectedShop] = useState(null);
  const autocompleteRef = useRef(null);

  // --- 回調函數 (保持不變) ---
  const onMapLoad = useCallback((map) => { mapRef.current=map; console.log("[HomePage] Map loaded."); const b=map.getBounds(); if(b)fetchShopsInBounds(b); else{const l=google.maps.event.addListener(map,'bounds_changed',()=>{const b2=map.getBounds(); if(b2){fetchShopsInBounds(b2);google.maps.event.removeListener(l);}});}}, []);
  const onMapUnmount = useCallback(() => { mapRef.current=null; console.log("[HomePage] Map unmounted."); }, []);
  const fetchShopsInBounds = useCallback(async(bounds)=>{ if(!bounds)return; setLoadingMapData(true); setErrorMapData(null); const ne=bounds.getNorthEast(); const sw=bounds.getSouthWest(); if(!ne||!sw){setLoadingMapData(false);return;} const params={minLat:sw.lat(),maxLat:ne.lat(),minLng:sw.lng(),maxLng:ne.lng()}; console.log("[HomePage] Fetching shops in bounds:", params); try{const res=await apiClient.get('/shops',{params}); if(res.data?.success&&Array.isArray(res.data.data)){console.log('[HomePage] Raw shops data from API:', res.data.data); setShops(res.data.data); console.log(`[HomePage] Fetched ${res.data.data.length} shops.`);}else{throw new Error(res.data?.message||"無法獲取店家");}}catch(err){console.error("[HomePage] Error fetching shops:",err); setErrorMapData(err?.response?.data?.message||err?.data?.message||err?.message||'無法載入店家'); setShops([]);}finally{setLoadingMapData(false);}},[]);
  const handleMapIdle = useCallback(() => { console.log("[HomePage] Map idle."); if(mapRef.current){const b=mapRef.current.getBounds(); if(b){console.log("[HomePage] Bounds on idle:",b.toJSON()); fetchShopsInBounds(b);}else{console.warn("[HomePage] No bounds on idle.");}} }, [fetchShopsInBounds]);
  const handleMarkerClick = (shop) => { console.log("[HomePage] Marker Clicked - Shop Data:", shop); setSelectedShop(shop); if(mapRef.current&&shop?.latitude&&shop?.longitude){const lat=parseFloat(shop.latitude);const lng=parseFloat(shop.longitude);if(!isNaN(lat)&&!isNaN(lng)){mapRef.current.panTo({lat,lng});}} };
  const handleInfoWindowClose = () => { setSelectedShop(null); };
  const onAutocompleteLoad = useCallback((ac) => { autocompleteRef.current=ac; console.log("[HomePage] Autocomplete loaded."); }, []);
  const onPlaceChanged = useCallback(() => { if(autocompleteRef.current){const p=autocompleteRef.current.getPlace(); console.log("[HomePage] Place selected:", p); if(p.geometry?.location&&mapRef.current){mapRef.current.panTo(p.geometry.location); mapRef.current.setZoom(15);}else{console.log('[HomePage] Invalid place.');}} }, []);
  // --- ---

  // --- 渲染邏輯 ---
  if (mapLoadError) { return ( <div className="homepage"><div className="loading-message error-message">地圖資源載入失敗: {mapLoadError.message}</div></div> ); }
  if (!mapLoaded) { return ( <div className="homepage"><div className="loading-message">地圖資源初始化中...</div></div> ); }

  return (
    <div className="homepage">
      {/* 搜索框 */}
      <div className="map-search-container">
        <Autocomplete onLoad={onAutocompleteLoad} onPlaceChanged={onPlaceChanged} options={{ componentRestrictions:{country:'tw'} }} fields={["geometry","name","formatted_address"]}>
          <input type="text" placeholder="搜尋地點、地址或拉麵店名..." className="map-search-input" onKeyDown={(e)=>{if(e.key==='Enter')e.preventDefault();}}/>
        </Autocomplete>
      </div>

      {/* 加載/錯誤提示 */}
      {loadingMapData && <div className="loading-overlay map-loading">載入店家標記中...</div>}
      {errorMapData && <div className="error-overlay map-error">錯誤: {errorMapData}</div>}

      {/* Google Map */}
      <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={8} options={defaultMapOptions} onLoad={onMapLoad} onUnmount={onMapUnmount} onIdle={handleMapIdle} onClick={handleInfoWindowClose}>
        {/* Markers */}
        {shops.map((shop) => {
          const lat = parseFloat(shop?.latitude);
          const lng = parseFloat(shop?.longitude);
          return shop && shop.id && !isNaN(lat) && !isNaN(lng) ? (
            <Marker key={`shop-${shop.id}`} position={{ lat, lng }} title={shop.name} onClick={() => handleMarkerClick(shop)} />
          ) : null;
        })}

        {/* InfoWindow */}
        {selectedShop && !isNaN(parseFloat(selectedShop.latitude)) && !isNaN(parseFloat(selectedShop.longitude)) && (
          <InfoWindow
            position={{ lat: parseFloat(selectedShop.latitude), lng: parseFloat(selectedShop.longitude) }}
            onCloseClick={handleInfoWindowClose}
            options={{ pixelOffset: new window.google.maps.Size(0, -35) }}
          >
             <div className="info-window-content">
              {/* *** 確保直接使用 selectedShop 的屬性 *** */}
              <h4>{selectedShop.name || 'N/A'}</h4>
              <p>{selectedShop.address || 'N/A'}</p>
              {/* *** --- *** */}
              <p className="info-window-rating">
                 評分: {selectedShop.averageRating ? parseFloat(selectedShop.averageRating).toFixed(1) : 'N/A'} / 5
                 ({selectedShop.reviewCount || 0} 則)
              </p>
              {selectedShop.id && <Link to={`/shops/${selectedShop.id}`} className="info-window-link">查看詳情 →</Link>}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

export default HomePage;