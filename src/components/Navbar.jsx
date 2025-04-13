// src/components/Navbar.jsx
import React, { useMemo } from 'react'; // 引入 useMemo
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth'; // 導入 useAuth
import { Role } from '../constants/roles'; // 導入角色常量
import './Navbar.css'; // 引入 Navbar 的 CSS

const Navbar = () => {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // --- 登出處理 ---
  const handleLogout = () => {
    logout();
    navigate('/login'); // 登出後跳轉到登錄頁
  };

  // --- 判斷是否為店家及獲取店家 ID (使用 useMemo 優化) ---
  const isShopOwner = useMemo(() => {
      if (!user) return false;
      const userRoles = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []);
      return userRoles.includes(Role.ROLE_SHOP_OWNER);
  }, [user]);

  const ownedShopId = useMemo(() => {
      if (isShopOwner && user) {
          if (Array.isArray(user.ownedShopIds) && user.ownedShopIds.length > 0) {
              return user.ownedShopIds[0]; // 優先使用陣列
          }
          if (user.ownedShopId) { // 兼容舊屬性
              return user.ownedShopId;
          }
      }
      return null;
  }, [user, isShopOwner]);
  // --- ---

  // --- 在認證狀態加載完成前，可以渲染簡化版 Navbar 或不渲染 ---
  // if (isLoading) {
  //     return (
  //         <nav className="navbar">
  //           <div className="navbar-container">
  //             <Link to="/" className="navbar-logo">🍜 台灣拉麵地圖</Link>
  //           </div>
  //         </nav>
  //     );
  // }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo/標題 */}
        <Link to="/" className="navbar-logo">
          🍜 台灣拉麵地圖
        </Link>

        {/* 導航菜單 */}
        <ul className="navbar-menu">
          {/* --- 公開連結 --- */}
          <li className="navbar-item">
            <Link to="/" className="navbar-link">首頁</Link>
          </li>
          <li className="navbar-item">
            <Link to="/shops" className="navbar-link">店家列表</Link>
          </li>
          {/* --- 排行榜連結 (需要登入，用戶或管理員) --- */}
           {(isAuthenticated && user && (Array.isArray(user.roles) ? user.roles.includes(Role.ROLE_USER) || user.roles.includes(Role.ROLE_ADMIN) : user.role === Role.ROLE_USER || user.role === Role.ROLE_ADMIN)) && (
             <li className="navbar-item">
               <Link to="/top-shops" className="navbar-link">排行榜</Link>
             </li>
           )}


          {/* === 管理員專屬連結 === */}
          {isAuthenticated && user && (Array.isArray(user.roles) ? user.roles.includes(Role.ROLE_ADMIN) : user.role === Role.ROLE_ADMIN) && (
            <>
              <li className="navbar-item">
                <Link to="/add-shop" className="navbar-link admin-link">新增店家</Link>
              </li>
              <li className="navbar-item">
                <Link to="/admin/users" className="navbar-link admin-link">用戶管理</Link>
              </li>
            </>
          )}
          {/* ==================== */}

          {/* === 根據登入狀態顯示 === */}
          {isAuthenticated && user ? ( // 確保 user 對象存在
            <>
              {/* *** 店家專屬連結：指向店家詳情頁 *** */}
              {isShopOwner && ownedShopId && (
                 <li className="navbar-item">
                   {/* 指向 /shops/:id */}
                   <Link to={`/shops/${ownedShopId}`} className="navbar-link owner-link">我的店家</Link>
                 </li>
              )}
              {/* --- --- */}

              {/* 用戶名和登出 */}
              <li className="navbar-item">
                <span className="navbar-user-greeting">你好, {user?.username || '用戶'}</span>
              </li>
              <li className="navbar-item">
                <button onClick={handleLogout} className="navbar-button logout-button">
                  登出
                </button>
              </li>
            </>
          ) : ( // 未登入時
            <>
              {/* 未登入時顯示登入和註冊 */}
              <li className="navbar-item">
                <Link to="/login" className="navbar-link">登入</Link>
              </li>
              <li className="navbar-item">
                <Link to="/signup" className="navbar-link signup-link">註冊食客</Link>
              </li>
               <li className="navbar-item">
                <Link to="/signup-shop" className="navbar-link owner-signup-link">註冊店家</Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;