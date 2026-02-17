import React from 'react';
import { Item } from '../types';

interface ItemCardProps {
  item: Item;
  onClick: () => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="item-card"
      style={{ '--item-color': item.color } as React.CSSProperties}
    >
      <div className="item-card-content">
        <span className="item-name">{item.name}</span>
        <span className="item-type">{item.type === 'category' ? '→' : '▶'}</span>
      </div>
    </button>
  );
};
