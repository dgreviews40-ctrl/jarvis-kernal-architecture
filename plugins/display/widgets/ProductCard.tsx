import React, { FC } from 'react';

interface ProductCardProps {
  title: string;
  description: string;
  price?: string;
  rating?: number;
  imageUrl?: string;
  onRecommend?: () => void;
  onDetails?: () => void;
}

export const ProductCard: FC<ProductCardProps> = ({ 
  title, 
  description, 
  price, 
  rating, 
  imageUrl, 
  onRecommend, 
  onDetails 
}) => {
  return (
    <div className="bg-gray-800 border border-cyan-700 rounded-lg p-4 w-64">
      {imageUrl && (
        <img 
          src={imageUrl} 
          alt={title} 
          className="w-full h-32 object-contain mb-3 rounded"
        />
      )}
      <h3 className="text-lg font-bold text-cyan-400 mb-1">{title}</h3>
      <p className="text-sm text-gray-300 mb-2">{description}</p>
      {rating && (
        <div className="text-yellow-400 text-sm mb-2">
          {'★'.repeat(Math.floor(rating))}
          {'☆'.repeat(5 - Math.floor(rating))}
          <span className="ml-1">({rating})</span>
        </div>
      )}
      {price && <div className="text-cyan-400 font-bold mb-3">{price}</div>}
      <div className="flex gap-2">
        {onRecommend && (
          <button 
            onClick={onRecommend}
            className="flex-1 bg-cyan-700 hover:bg-cyan-600 text-white py-1 px-2 rounded text-xs"
          >
            Recommend
          </button>
        )}
        {onDetails && (
          <button 
            onClick={onDetails}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-1 px-2 rounded text-xs"
          >
            Details
          </button>
        )}
      </div>
    </div>
  );
};