// src/components/Navbar.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth'; // 確保導入 useAuth (默認導出)
import { Role } from '../constants/roles'; // *** 導入角色常量 ***
import './Navbar.css'; // 引入 Navbar 的 CSS

const Navbar = () => {
  const { user, logout, isAuthenticated, isLoading } = useAuth(); // 添加 isAuthenticated 和 isLoading
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login'); // 登出後跳轉到登錄頁
  };

  // --- 獲取店家 ID (如果 user 對象包含 ownedShops) ---
  const getOwnedShopId = () => {
      // 需要確保 user 和 ownedShops 都已加載且不為 null/undefined
      if (isAuthenticated && user && user.role === Role.ROLE_SHOP_OWNER && Array.isArray(user.ownedShops) && user.ownedShops.length > 0) {
          // 假設只有一家店
          return user.ownedShops[0]?.id;
      }
      return null;
  }
  const ownedShopId = getOwnedShopId();
  // --- ---

  // --- 在認證狀態加載完成前，可以選擇不渲染或渲染簡化版 Navbar ---
  // if (isLoading) {
  //     return <nav className="navbar"><div className="navbar-container"><Link to="/" className="navbar-logo">台灣拉麵地圖</Link></div></nav>; // 或者 return null;
  // }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo/標題 */}
        <Link to="/" className="navbar-logo">
          🍜 台灣拉麵地圖 {/* 加個 icon */}
        </Link>

        {/* 導航菜單 */}
        <ul className="navbar-menu">
          {/* 公開連結 */}
          <li className="navbar-item">
            <Link to="/" className="navbar-link">首頁</Link>
          </li>
          <li className="navbar-item">
            <Link to="/shops" className="navbar-link">店家列表</Link>
          </li>
          {/* 排行榜連結 - 根據權限顯示 */}
           {(isAuthenticated && (user?.roles?.includes(Role.ROLE_USER) || user?.roles?.includes(Role.ROLE_ADMIN))) && (
             <li className="navbar-item">
               <Link to="/top-shops" className="navbar-link">排行榜</Link>
             </li>
           )}


          {/* === 管理員專屬連結 === */}
          {isAuthenticated && user?.roles?.includes(Role.ROLE_ADMIN) && (
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
          {isAuthenticated ? (
            <>
              {/* 店家管理連結 */}
              {user?.role === Role.ROLE_SHOP_OWNER && ownedShopId && (
                 <li className="navbar-item">
                   <Link to={`/shops/${ownedShopId}/edit`} className="navbar-link owner-link">我的店家</Link>
                   {/* 或者跳轉到詳情頁： <Link to={`/shops/${ownedShopId}`} ...>我的店面</Link> */}
                 </li>
              )}
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
          ) : (
            <>
              {/* 未登入時顯示登入和註冊 */}
              <li className="navbar-item">
                <Link to="/login" className="navbar-link">登入</Link>
              </li>
              <li className="navbar-item">
                 {/* 可以用按鈕樣式 */}
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