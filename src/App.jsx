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
import ShopDetailPage from './pages/ShopDetailPage'; // 假設 ShopDetailPage.jsx 已更新
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ShopOwnerSignupPage from './pages/ShopOwnerSignupPage';
import AddShopPage from './pages/AddShopPage';
import EditShopPage from './pages/EditShopPage';
import TopShopsPage from './pages/TopShopsPage';
// import MyOwnedShopPage from './pages/MyOwnedShopPage'; // *** 不再需要導入 ***
import AdminUserManagementPage from './pages/AdminUserManagementPage';
import NotFoundPage from './pages/NotFoundPage';

// --- 全局樣式 ---
import './App.css';
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
// --- ---

// --- Google Maps API Key 和 Libraries ---
const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const libraries = ['places', 'maps'];
// --- ---

function App() {
  // --- 加載 Google Maps API ---
  const { isLoaded: mapLoaded, loadError: mapLoadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey || "",
    libraries: libraries,
  });

   // 檢查 API Key 是否設置
   if (!googleMapsApiKey && !mapLoadError) {
       console.error("前端警告：未設定 Google Maps API 金鑰 (VITE_GOOGLE_MAPS_API_KEY)。地圖功能將無法使用。");
   }
  // --- ---

  return (
    // AuthProvider 包裹整個應用，提供認證狀態
    <AuthProvider>
        <Navbar /> {/* 顯示導航欄 */}
        <div className="main-content"> {/* 主要內容區域 */}
          <Routes> {/* 定義應用程式的路由 */}

            {/* === 公開路由 === */}
            <Route
              path="/"
              element={<HomePage mapLoaded={mapLoaded} mapLoadError={mapLoadError} />}
            />
            <Route
              path="/shops"
              element={<ShopListPage />}
            />
            <Route
              path="/shops/:id" // 店家詳情頁 (現在包含店家視角邏輯)
              element={<ShopDetailPage mapLoaded={mapLoaded} mapLoadError={mapLoadError} />}
            />
            <Route
              path="/login"
              element={<LoginPage />}
            />
            <Route
              path="/signup"
              element={<SignupPage />}
            />
            <Route
              path="/signup-shop"
              element={<ShopOwnerSignupPage />}
            />
            {/* === --- === */}


            {/* === 受保護路由 === */}

            {/* 排行榜頁 (需要登入 - 用戶或管理員) */}
            <Route
               path="/top-shops"
               element={
                 <ProtectedRoute allowedRoles={[Role.ROLE_USER, Role.ROLE_ADMIN]}>
                   <TopShopsPage />
                 </ProtectedRoute>
               }
             />

            {/* 新增店家頁 (僅限管理員) */}
            <Route
              path="/add-shop"
              element={
                <ProtectedRoute allowedRoles={[Role.ROLE_ADMIN]}>
                  <AddShopPage mapLoaded={mapLoaded} mapLoadError={mapLoadError} />
                </ProtectedRoute>
              }
            />

            {/* 編輯店家頁 (管理員或店家本人) */}
            {/* ProtectedRoute 會處理角色檢查，EditShopPage 內部需要驗證是否為店家本人 (如果不是管理員) */}
            <Route
              path="/shops/:id/edit"
              element={
                <ProtectedRoute allowedRoles={[Role.ROLE_ADMIN, Role.ROLE_SHOP_OWNER]}>
                  <EditShopPage mapLoaded={mapLoaded} mapLoadError={mapLoadError} />
                </ProtectedRoute>
              }
            />

             {/* *** 移除 /my-shop 路由 *** */}
             {/*
             <Route
               path="/my-shop"
               element={
                 <ProtectedRoute allowedRoles={[Role.ROLE_SHOP_OWNER]}>
                   <MyOwnedShopPage mapLoaded={mapLoaded} mapLoadError={mapLoadError} />
                 </ProtectedRoute>
               }
             />
             */}

             {/* 用戶管理頁 (僅限管理員) */}
             <Route
               path="/admin/users"
               element={
                 <ProtectedRoute allowedRoles={[Role.ROLE_ADMIN]}>
                   <AdminUserManagementPage />
                 </ProtectedRoute>
               }
             />
            {/* === --- === */}


            {/* === 404 Not Found 路由 (匹配所有其他路徑) === */}
            <Route path="*" element={<NotFoundPage />} />
            {/* === --- === */}

          </Routes> {/* <--- Routes 結束 */}
        </div>
    </AuthProvider>
  );
}

export default App;