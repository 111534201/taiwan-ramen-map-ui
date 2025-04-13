// src/App.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { useJsApiLoader } from '@react-google-maps/api';

// --- 核心組件導入 ---
import Navbar from './components/Navbar'; // 假設 Navbar.jsx 已更新
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext'; // 確保使用正確的 AuthProvider
import { Role } from './constants/roles'; // 導入角色常量

// --- 頁面組件導入 ---
import HomePage from './pages/HomePage';
import ShopListPage from './pages/ShopListPage';
import ShopDetailPage from './pages/ShopDetailPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ShopOwnerSignupPage from './pages/ShopOwnerSignupPage';
import AddShopPage from './pages/AddShopPage';
import EditShopPage from './pages/EditShopPage';
import TopShopsPage from './pages/TopShopsPage';
import AdminUserManagementPage from './pages/AdminUserManagementPage';
import NotFoundPage from './pages/NotFoundPage';

// --- 全局樣式 ---
import './App.css';
import "slick-carousel/slick/slick.css"; // 輪播圖樣式
import "slick-carousel/slick/slick-theme.css";
// --- ---

// --- Google Maps API Key 和 Libraries ---
const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const libraries = ['places']; // <-- **只加載 Places API**
// --- ---

function App() {
  // --- 加載 Google Maps API (在應用頂層執行一次) ---
  const { isLoaded: mapLoaded, loadError: mapLoadError } = useJsApiLoader({
    // id: 'google-map-script', // ID 可以省略，讓 @react-google-maps/api 自動處理
    googleMapsApiKey: googleMapsApiKey || "", // 確保傳入空字串如果 key 不存在，避免錯誤
    libraries: libraries, // 使用定義好的庫列表
  });

   // 檢查 API Key 是否設置 (僅在開發環境提示)
   if (import.meta.env.DEV && !googleMapsApiKey && !mapLoadError) {
       console.error(
           "前端警告：未在 .env 文件中設定有效的 Google Maps API 金鑰 (VITE_GOOGLE_MAPS_API_KEY)。" +
           "地圖功能將無法使用。請參考 https://developers.google.com/maps/documentation/javascript/get-api-key"
       );
   }
  // --- ---

  return (
    // AuthProvider 提供認證上下文
    <AuthProvider>
        <Navbar /> {/* 導航欄 */}
        <div className="main-content"> {/* 主要內容容器 */}
          <Routes> {/* 路由配置 */}

            {/* === 公開路由 === */}
            <Route
              path="/"
              // 將地圖加載狀態傳遞給 HomePage
              element={<HomePage mapLoaded={mapLoaded} mapLoadError={mapLoadError} />}
            />
            <Route
              path="/shops"
              element={<ShopListPage />} // 列表頁通常不需要地圖 API
            />
            <Route
              path="/shops/:id"
              // 將地圖加載狀態傳遞給 ShopDetailPage
              element={<ShopDetailPage mapLoaded={mapLoaded} mapLoadError={mapLoadError} />}
            />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/signup-shop" element={<ShopOwnerSignupPage />} />
            {/* === --- === */}


            {/* === 受保護路由 === */}
            <Route
               path="/top-shops"
               element={
                 <ProtectedRoute allowedRoles={[Role.ROLE_USER, Role.ROLE_ADMIN, Role.ROLE_SHOP_OWNER]}> {/* 允許所有登入用戶訪問 */}
                   <TopShopsPage />
                 </ProtectedRoute>
               }
             />
            <Route
              path="/add-shop"
              element={
                <ProtectedRoute allowedRoles={[Role.ROLE_ADMIN]}> {/* 僅限管理員 */}
                  {/* 如果 AddShopPage 需要地圖，也傳遞 props */}
                  <AddShopPage mapLoaded={mapLoaded} mapLoadError={mapLoadError} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shops/:id/edit"
              element={
                <ProtectedRoute allowedRoles={[Role.ROLE_ADMIN, Role.ROLE_SHOP_OWNER]}> {/* 管理員或店家 */}
                  {/* 如果 EditShopPage 需要地圖，也傳遞 props */}
                  <EditShopPage mapLoaded={mapLoaded} mapLoadError={mapLoadError} />
                </ProtectedRoute>
              }
            />
             <Route
               path="/admin/users"
               element={
                 <ProtectedRoute allowedRoles={[Role.ROLE_ADMIN]}> {/* 僅限管理員 */}
                   <AdminUserManagementPage />
                 </ProtectedRoute>
               }
             />
            {/* === --- === */}

            {/* 404 路由 */}
            <Route path="*" element={<NotFoundPage />} />

          </Routes>
        </div>
    </AuthProvider>
  );
}

export default App;