import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';

export default function Menu() {
  const { restaurant } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    if (restaurant?.id) {
      fetchMenu();
    }
  }, [restaurant?.id]);

  async function fetchMenu() {
    try {
      const [{ data: cats }, { data: menuItems }] = await Promise.all([
        supabase
          .from('categories')
          .select('*')
          .eq('restaurant_id', restaurant.id)
          .order('sort_order'),
        supabase
          .from('menu_items')
          .select('*, category:categories(name)')
          .eq('restaurant_id', restaurant.id)
          .order('created_at', { ascending: false })
      ]);

      setCategories(cats || []);
      setItems(menuItems || []);
    } catch (err) {
      toast.error('Erreur de chargement du menu');
    } finally {
      setLoading(false);
    }
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return;

    try {
      const { error } = await supabase
        .from('categories')
        .insert({
          restaurant_id: restaurant.id,
          name: newCategoryName.trim(),
          sort_order: categories.length
        });

      if (error) throw error;

      toast.success('Catégorie ajoutée');
      setNewCategoryName('');
      setShowCategoryModal(false);
      fetchMenu();
    } catch (err) {
      toast.error('Erreur lors de l\'ajout');
    }
  }

  async function deleteCategory(catId) {
    if (!window.confirm('Supprimer cette catégorie ?')) return;

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', catId);

      if (error) throw error;

      toast.success('Catégorie supprimée');
      if (activeCategory === catId) setActiveCategory('all');
      fetchMenu();
    } catch (err) {
      toast.error('Impossible de supprimer (des plats sont liés)');
    }
  }

  async function toggleItemActive(item) {
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_active: !item.is_active })
        .eq('id', item.id);

      if (error) throw error;

      setItems(prev =>
        prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i)
      );

      toast.success(item.is_active ? 'Plat désactivé' : 'Plat activé');
    } catch (err) {
      toast.error('Erreur');
    }
  }

  async function deleteItem(itemId) {
    if (!window.confirm('Supprimer ce plat ?')) return;

    try {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setItems(prev => prev.filter(i => i.id !== itemId));
      toast.success('Plat supprimé');
    } catch (err) {
      toast.error('Erreur lors de la suppression');
    }
  }

  const filteredItems = activeCategory === 'all'
    ? items
    : items.filter(i => i.category_id === activeCategory);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg" />
        <p>Chargement du menu...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Mon Menu</h1>
          <p className="page-subtitle">{items.length} plat{items.length > 1 ? 's' : ''}</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/menu/add')}
          id="add-dish-btn"
        >
          + Plat
        </button>
      </div>

      {/* Categories */}
      <div className="flex items-center gap-sm mb-md" style={{ flexWrap: 'wrap' }}>
        <div className="tab-bar" style={{ marginBottom: 0, flex: 1 }}>
          <button
            className={`tab ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            Tout
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`tab ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
              onContextMenu={(e) => { e.preventDefault(); deleteCategory(cat.id); }}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowCategoryModal(true)}
          title="Ajouter une catégorie"
        >
          + Cat.
        </button>
      </div>

      {/* Items */}
      {filteredItems.length === 0 ? (
        <div className="empty-state">
          <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
            <path d="M3 6h18M3 12h18M3 18h12" />
          </svg>
          <h3>Aucun plat</h3>
          <p>Ajoutez votre premier plat au menu</p>
          <button className="btn btn-primary mt-md" onClick={() => navigate('/menu/add')}>
            + Ajouter un plat
          </button>
        </div>
      ) : (
        filteredItems.map(item => (
          <div key={item.id} className={`menu-item-card ${!item.is_active ? 'inactive' : ''}`}>
            {item.photo_url ? (
              <img src={item.photo_url} alt={item.name} className="menu-item-thumb" />
            ) : (
              <div className="menu-item-thumb" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', fontSize: '24px'
              }}>
                🍽️
              </div>
            )}

            <div className="menu-item-info">
              <div className="menu-item-name">{item.name}</div>
              <div className="menu-item-category">{item.category?.name || 'Sans catégorie'}</div>
              <div className="menu-item-price">{Number(item.price).toFixed(2)} FCFA</div>
            </div>

            <div className="menu-item-actions">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={item.is_active}
                  onChange={() => toggleItemActive(item)}
                />
                <span className="toggle-slider" />
              </label>

              <div className="flex gap-xs">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => navigate(`/menu/edit/${item.id}`)}
                  title="Modifier"
                >
                  ✏️
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => deleteItem(item.id)}
                  title="Supprimer"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="cart-handle" />
            <div className="modal-header">
              <h2 className="modal-title">Nouvelle catégorie</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCategoryModal(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="category-name">Nom de la catégorie</label>
              <input
                id="category-name"
                type="text"
                className="form-input"
                placeholder="Ex: Entrées, Plats, Desserts..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              />
            </div>
            <button className="btn btn-primary btn-full" onClick={addCategory}>
              Ajouter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
