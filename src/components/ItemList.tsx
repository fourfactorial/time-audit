import React from 'react';
import { Item } from '../types';
import { ItemCard } from './ItemCard';
import { getItemChildren, getRootItems } from '../utils/helpers';

interface ItemListProps {
  items: Item[];
  currentCategoryId: string | null;
  onSelectItem: (item: Item) => void;
  onBack: () => void;
}

export const ItemList: React.FC<ItemListProps> = ({
  items,
  currentCategoryId,
  onSelectItem,
  onBack,
}) => {
  const displayItems = currentCategoryId
    ? getItemChildren(items, currentCategoryId)
    : getRootItems(items);

  const currentCategory = currentCategoryId
    ? items.find(i => i.id === currentCategoryId)
    : null;

  return (
    <div className="item-list">
      <div className="list-header">
        {currentCategoryId && (
          <button onClick={onBack} className="back-button">
            ← Back
          </button>
        )}
        <h2 className="list-title">
          {currentCategory ? currentCategory.name : 'Time Tracker'}
        </h2>
      </div>
      
      <div className="items-grid">
        {displayItems.length === 0 ? (
          <div className="empty-state">
            <p>No items yet. Create your first category or task.</p>
          </div>
        ) : (
          displayItems.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              onClick={() => onSelectItem(item)}
            />
          ))
        )}
      </div>
    </div>
  );
};
