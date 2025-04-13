// src/components/ShopCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { renderStars } from '../utils/uiUtils'; // *** 從 utils 導入 renderStars ***
import './ShopCard.css'; // 引入對應的 CSS

// --- 輔助函數：構建完整的圖片 URL (如果後端返回相對路徑) ---
// 你可以將這個函數也移到 utils 文件中
const buildImageUrl = (relativePath) => {
    if (!relativePath) {
        return '/placeholder-image.png'; // 返回預設佔位圖路徑
    }
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
        return relativePath; // 如果已經是完整 URL，直接返回
    }
    // 從環境變數獲取基礎 URL 和上傳路徑前綴
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
    const uploadPath = '/uploads'; // 假設後端配置的訪問路徑是 /uploads/

    // 確保路徑分隔符正確
    const cleanRelativePath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    const fullUrl = `${baseUrl}${uploadPath}/${cleanRelativePath}`;
    // console.log('Building Image URL:', relativePath, '->', fullUrl); // 調試用
    return fullUrl;
};
// --- ---


const ShopCard = ({ shop }) => {
  // --- 提供預設值，防止 shop 或其屬性為 null/undefined ---
  const shopId = shop?.id; // ID 用於鏈接，如果不存在則 Link 會失效，是預期行為
  const shopName = shop?.name || '店家名稱 N/A';
  const shopAddress = shop?.address || '地址未提供';
  const averageRating = parseFloat(shop?.averageRating) || 0; // 確保是數字
  const reviewCount = shop?.reviewCount || 0;

  // --- 處理封面圖片 ---
  // 1. 嘗試獲取 media 列表中的第一個元素的 url
  const relativeCoverPath = shop?.media?.[0]?.url;
  // 2. 使用輔助函數構建完整的 URL
  const coverImageUrl = buildImageUrl(relativeCoverPath);
  // --- ---

  // 如果 shopId 無效，可能不渲染 Link 或整個卡片
  if (!shopId) {
      console.warn("ShopCard: 無效的 shop ID，無法生成連結。", shop);
      // 可以選擇返回 null 或一個提示信息
      // return null;
      // 或者渲染一個不可點擊的卡片
      return (
          <div className="shop-card invalid-card">
              <p>店家資料錯誤</p>
          </div>
      );
  }

  return (
    <div className="shop-card">
      {/* 連結到店家詳情頁 */}
      <Link to={`/shops/${shopId}`} className="shop-card-link">
        <div className="shop-card-image-container">
          <img
            src={coverImageUrl} // *** 使用構建好的完整 URL ***
            alt={`${shopName} 封面`}
            className="shop-card-image"
            loading="lazy" // 啟用圖片懶加載
            onError={(e) => { // 圖片加載失敗處理
                console.warn(`ShopCard: 圖片加載失敗 for shop ${shopId}: ${coverImageUrl}`);
                e.target.onerror = null; // 防止無限循環
                e.target.src = '/placeholder-image.png'; // 替換為佔位圖
            }}
          />
        </div>
        <h3 className="shop-card-title">{shopName}</h3>
      </Link>

      {/* 店家摘要信息 */}
      <div className="shop-card-info">
        <p className="shop-card-address">{shopAddress}</p>
        <div className="shop-card-rating">
          {/* 使用導入的 renderStars 函數 */}
          <span className="stars">{renderStars(averageRating)}</span>
          <span className="rating-text">
            {averageRating > 0 ? averageRating.toFixed(1) : 'N/A'}
          </span>
          <span className="review-count">({reviewCount} 則評論)</span>
        </div>
      </div>

      {/* 查看詳情按鈕 */}
       <Link to={`/shops/${shopId}`} className="shop-card-details-button">
         查看詳情
       </Link>
    </div>
  );
};

// 引入 PropTypes 進行類型檢查 (可選但推薦)
import PropTypes from 'prop-types';
ShopCard.propTypes = {
    shop: PropTypes.shape({
        id: PropTypes.number.isRequired,
        name: PropTypes.string,
        address: PropTypes.string,
        averageRating: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        reviewCount: PropTypes.number,
        media: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.number,
            url: PropTypes.string, // 期望這裡包含相對路徑或完整 URL
            type: PropTypes.string
        }))
    }).isRequired
};


export default ShopCard;