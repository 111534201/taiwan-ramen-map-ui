// src/pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth'; // 確保導入正確 (無花括號)
import { Role } from '../constants/roles';     // 導入角色常量
import { decodeToken } from '../utils/authUtils'; // 導入 decodeToken 工具函數
import './AuthForm.css'; // 引入共享樣式

const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false); // 提交加載狀態
    const navigate = useNavigate();
    const location = useLocation();
    // 從 AuthContext 獲取狀態和方法
    const { login, logout, isAuthenticated, isLoading: isAuthLoading, user } = useAuth();

    // --- 效果：如果已登入，根據角色重定向 ---
    useEffect(() => {
        // 確保 AuthContext 的初始加載已完成
        if (!isAuthLoading && isAuthenticated) {
            let navigateTo = '/'; // 預設跳轉路徑
            // 判斷角色並設置跳轉目標
            if (user?.roles?.includes(Role.ROLE_SHOP_OWNER)) {
                // 檢查店家是否有 ID，如果有則跳轉，否則可能跳到提示頁或首頁
                const ownedShopId = user.ownedShopId || (Array.isArray(user.ownedShopIds) && user.ownedShopIds.length > 0 ? user.ownedShopIds[0] : null);
                if (ownedShopId) {
                     navigateTo = '/my-shop';
                } else {
                     console.warn("店家用戶登入，但未找到 ownedShopId，跳轉至首頁");
                     // navigateTo = '/complete-shop-profile'; // 或者跳轉到完善店家資料頁
                }
            } else if (user?.roles?.includes(Role.ROLE_ADMIN)) {
                navigateTo = '/admin/users'; // 管理員跳轉到用戶管理
            }
            // 對於普通用戶 (ROLE_USER)，保留跳轉回原頁面或首頁的邏輯
            else {
                 const from = location.state?.from?.pathname;
                  // 避免無限循環跳轉回登錄頁
                 if (from && from !== '/login') {
                     navigateTo = from;
                 }
            }

            console.log('[LoginPage] Already authenticated or login successful. Redirecting to:', navigateTo);
            navigate(navigateTo, { replace: true }); // 使用 replace 避免瀏覽歷史記錄堆疊
        }
    }, [isAuthenticated, isAuthLoading, navigate, user, location.state]); // 添加 user 和 location.state 作為依賴

    // --- 處理表單提交 ---
    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setIsLoading(true);

        const result = await login(username, password); // 調用 AuthContext 的 login

        setIsLoading(false);

        if (!result.success) {
            // 登入失敗，顯示錯誤信息
            setError(result.message || '登入失敗，請檢查您的用戶名和密碼。');
        }
        // 登入成功後的跳轉邏輯已移至上面的 useEffect 中，
        // 因為 login 成功後會更新 isAuthenticated 和 user 狀態，觸發 useEffect 執行
    };

     // --- 初始加載狀態顯示 ---
     if (isAuthLoading) {
         return <div className="loading" style={{ padding: '2rem', textAlign: 'center' }}>檢查登入狀態中...</div>;
     }

    // --- 渲染登入表單 ---
    return (
        <div className="auth-container">
            <div className="auth-form-wrapper">
                <h2>登入 拉麵地圖</h2>
                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <div className="error-message">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="username">用戶名</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoComplete="username"
                            disabled={isLoading} // 在提交過程中禁用
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">密碼</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            disabled={isLoading}
                        />
                    </div>

                    <button type="submit" className="submit-button" disabled={isLoading}>
                        {isLoading ? '登入中...' : '登入'}
                    </button>
                </form>

                <div className="auth-switch">
                    還沒有帳號？{' '}
                    <Link to="/signup">註冊食客帳號</Link>
                    {' | '} {/* 添加分隔符 */}
                    <Link to="/signup-shop">註冊成為店家</Link>
                </div>
            </div>
        </div>
    );
};
export default LoginPage;