// src/pages/HomePage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// *** 移除 useJsApiLoader 導入 ***
import { GoogleMap, InfoWindow, Autocomplete } from '@react-google-maps/api';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import apiClient from '../services/api';
import './HomePage.css';

// --- 常量定義 ---
const containerStyle = { width: '100%', height: 'calc(100vh - 60px)', minHeight: '400px' };
const center = { lat: 23.6978, lng: 120.9605 };
const defaultMapOptions = { streetViewControl: false, mapTypeControl: false, fullscreenControl: true, zoomControl: true, gestureHandling: 'cooperative' };
// --- ---

// *** 修改這裡：接收 props ***
const HomePage = ({ mapLoaded, mapLoadError }) => {
  // *** 移除 useJsApiLoader 調用 ***
  // const { isLoaded, loadError } = useJsApiLoader({ ... });

  const mapRef = useRef(null);
  const markerClustererRef = useRef(null);
  const markersRef = useRef({});
  const [shops, setShops] = useState([]);
  const [loadingMapData, setLoadingMapData] = useState(false);
  const [errorMapData, setErrorMapData] = useState(null);
  const [selectedShop, setSelectedShop] = useState(null);
  const autocompleteRef = useRef(null);
  const navigate = useNavigate();

  // --- 地圖加載回調 ---
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    console.log("[HomePage] Google Map loaded via prop."); // 修改日誌
    const bounds = map.getBounds();
    if (bounds) {
      fetchShopsInBounds(bounds);
    } else {
        console.warn("[HomePage] Map loaded but getBounds() returned null initially.");
        // 可以添加一個延遲或監聽 bounds_changed 事件來獲取初始 bounds
         const listener = map.addListener('bounds_changed', () => {
             const bounds2 = map.getBounds();
             if (bounds2) {
                 console.log("[HomePage] Map bounds available after bounds_changed.");
                 fetchShopsInBounds(bounds2);
                 // 獲取到後移除監聽器
                 if (window.google && window.google.maps && window.google.maps.event) {
                     window.google.maps.event.removeListener(listener);
                 }
             }
         });
    }
  }, []); // 移除 fetchShopsInBounds

  // --- 地圖卸載回調 ---
  const onMapUnmount = useCallback(() => {
    console.log("[HomePage] Google Map unmounted.");
    if (markerClustererRef.current) { markerClustererRef.current.clearMarkers(); markerClustererRef.current = null; }
    markersRef.current = {};
    mapRef.current = null;
  }, []);

  // --- 獲取範圍內店家 ---
  const fetchShopsInBounds = useCallback(async (bounds) => {
    if (!bounds) return;
    setLoadingMapData(true); setErrorMapData(null);
    const ne = bounds.getNorthEast(); const sw = bounds.getSouthWest();
    if (!ne || !sw) { setLoadingMapData(false); return; }
    const params = { minLat: sw.lat(), maxLat: ne.lat(), minLng: sw.lng(), maxLng: ne.lng() };
    try {
      const response = await apiClient.get('/shops', { params });
      if (response.data?.success && Array.isArray(response.data.data)) {
        setShops(response.data.data);
      } else { throw new Error(response.data?.message || "無法獲取店家"); }
    } catch (err) { console.error("[HomePage] Error fetching shops:", err); setErrorMapData(err?.response?.data?.message || err?.message || '無法載入店家'); setShops([]); }
    finally { setLoadingMapData(false); }
  }, []);

  // --- 地圖空閒回調 ---
  const handleMapIdle = useCallback(() => {
    if (mapRef.current) {
      const bounds = mapRef.current.getBounds();
      if (bounds) fetchShopsInBounds(bounds);
    }
  }, [fetchShopsInBounds]);

  // --- Marker 點擊處理 ---
   const handleMarkerClick = useCallback((shop) => {
     setSelectedShop(shop);
     if (mapRef.current && shop?.latitude && shop?.longitude) {
       const lat = parseFloat(shop.latitude); const lng = parseFloat(shop.longitude);
       if (!isNaN(lat) && !isNaN(lng)) mapRef.current.panTo({ lat, lng });
     }
   }, []);
   const handleInfoWindowClose = useCallback(() => { setSelectedShop(null); }, []);

  // --- 自動完成相關回調 ---
  const onAutocompleteLoad = useCallback((ac) => { autocompleteRef.current = ac; }, []);
  const onPlaceChanged = useCallback(() => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat(); const lng = place.geometry.location.lng();
        if (mapRef.current) { mapRef.current.panTo({ lat, lng }); mapRef.current.setZoom(15); }
      } else console.warn("Autocomplete place has no geometry.");
    } else console.error("Autocomplete was not loaded properly.");
  }, []);

  // --- useEffect 處理 Marker 和 MarkerClusterer ---
  useEffect(() => {
      // *** 修改這裡：使用 mapLoaded prop 和 mapRef.current ***
      if (!mapRef.current || !mapLoaded || !window.google) return;

      if (!markerClustererRef.current) {
          markerClustererRef.current = new MarkerClusterer({ map: mapRef.current });
          console.log("[HomePage] MarkerClusterer initialized using mapRef.");
      }

      const nextMarkers = {};
      shops.forEach(shop => {
          const lat = parseFloat(shop?.latitude); const lng = parseFloat(shop?.longitude);
          if (shop?.id && !isNaN(lat) && !isNaN(lng)) {
              const position = { lat, lng };
              if (markersRef.current[shop.id]) {
                  nextMarkers[shop.id] = markersRef.current[shop.id];
                   if (markersRef.current[shop.id].getPosition()?.lat() !== lat || markersRef.current[shop.id].getPosition()?.lng() !== lng) {
                       markersRef.current[shop.id].setPosition(position);
                   }
              } else {
                  const newMarker = new window.google.maps.Marker({ position, title: shop.name });
                  newMarker.addListener('click', () => handleMarkerClick(shop));
                  nextMarkers[shop.id] = newMarker;
              }
          }
      });

      const markersToAdd = []; const markersToRemove = [];
      for (const shopId in nextMarkers) if (!markersRef.current[shopId]) markersToAdd.push(nextMarkers[shopId]);
      for (const shopId in markersRef.current) if (!nextMarkers[shopId]) markersToRemove.push(markersRef.current[shopId]);

      if (markerClustererRef.current) {
          if (markersToRemove.length > 0) markerClustererRef.current.removeMarkers(markersToRemove, true);
          if (markersToAdd.length > 0) markerClustererRef.current.addMarkers(markersToAdd, true);
          if (markersToAdd.length > 0 || markersToRemove.length > 0) markerClustererRef.current.render();
      }

      markersRef.current = nextMarkers;

  // *** 修改這裡：使用 mapLoaded 替代 isLoaded ***
  }, [mapLoaded, shops, handleMarkerClick]); // 依賴 mapLoaded, shops, handleMarkerClick

  // --- 渲染邏輯 ---
  // *** 修改這裡：使用 mapLoadError 和 mapLoaded ***
  if (mapLoadError) { return <div className="homepage"><div className="loading-message error-message">地圖API加載失敗: {mapLoadError.message}</div></div>; }
  if (!mapLoaded) { return <div className="homepage"><div className="loading-message">地圖加載中...</div></div>; }

  return (
    <div className="homepage">
      {/* 搜索框 */}
      <div className="map-search-container">
        <Autocomplete onLoad={onAutocompleteLoad} onPlaceChanged={onPlaceChanged} options={{ componentRestrictions:{country:'tw'} }} fields={["geometry","name","formatted_address"]}>
          <input type="text" placeholder="搜尋地點、地址或拉麵店名..." className="map-search-input" onKeyDown={(e)=>{if(e.key==='Enter')e.preventDefault();}}/>
        </Autocomplete>
      </div>

      {/* 加載/錯誤提示 */}
      {loadingMapData && <div className="loading-overlay map-loading">更新店家標記中...</div>}
      {errorMapData && <div className="error-overlay map-error">錯誤: {errorMapData}</div>}

      {/* Google Map */}
      <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={8}
          options={defaultMapOptions}
          onLoad={onMapLoad} // 這個 onLoad 很重要，它設置 mapRef.current
          onUnmount={onMapUnmount}
          onIdle={handleMapIdle}
          onClick={handleInfoWindowClose}
      >
        {/* InfoWindow */}
        {selectedShop && !isNaN(parseFloat(selectedShop.latitude)) && !isNaN(parseFloat(selectedShop.longitude)) && (
          <InfoWindow
            position={{ lat: parseFloat(selectedShop.latitude), lng: parseFloat(selectedShop.longitude) }}
            onCloseClick={handleInfoWindowClose}
            options={{ pixelOffset: new window.google.maps.Size(0, -30) }}
          >
             <div className="info-window-content">
              <h4>{selectedShop.name || 'N/A'}</h4>
              <p>{selectedShop.address || 'N/A'}</p>
              <p className="info-window-rating">
                 評分: {selectedShop.averageRating ? parseFloat(selectedShop.averageRating).toFixed(1) : 'N/A'} / 5
                 ({selectedShop.reviewCount || 0} 則)
              </p>
              <Link to={`/shops/${selectedShop.id}`} className="info-window-link">查看詳情 →</Link>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

export default HomePage;