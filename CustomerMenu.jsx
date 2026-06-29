import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import TikTokFeed from '../components/TikTokFeed';
import OrderCart from '../components/OrderCart';

export default function CustomerMenu() {
  const { code } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (code) {
      fetchRestaurantAndMenu(code);
    }
  }, [code]);

  async function fetchRestaurantAndMenu(restaurantCode) {
    try {
      setLoading(true);
      
      // 1. Find restaurant by code
      const { data: resto, error: restoError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('code', restaurantCode)
        .single();

      if (restoError || !resto) {
        throw new Error('Restaurant introuvable');
      }

      setRestaurant(resto);

      // 2. Fetch active menu items
      const { data: items, error: itemsError } = await supabase
        .from('menu_items')
        .select('*, category:categories(name)')
        .eq('restaurant_id', resto.id)
        .eq('is_active', true)
        .order('category_id')
        .order('created_at', { ascending: false });

      if (itemsError) throw itemsError;

      setMenuItems(items || []);

      // 3. Track analytics (page view) silently
      items?.forEach(item => {
        supabase.from('analytics').upsert({
          restaurant_id: resto.id,
          menu_item_id: item.id,
          views: 1 // In a real app we'd increment, but RLS makes this tricky without a stored procedure
        }).catch(() => {});
      });

    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleAddToCart(item) {
    setCart(prev => {
      const current = prev[item.id];
      const newQuantity = current ? current.quantity + 1 : 1;
      
      return {
        ...prev,
        [item.id]: {
          ...item,
          quantity: newQuantity
        }
      };
    });
    
    toast.success(`${item.name} ajouté au panier`);
  }

  function handleUpdateCart(item, change) {
    setCart(prev => {
      const current = prev[item.id];
      if (!current) return prev;
      
      const newQuantity = current.quantity + change;
      
      if (newQuantity <= 0) {
        const newCart = { ...prev };
        delete newCart[item.id];
        return newCart;
      }
      
      return {
        ...prev,
        [item.id]: {
          ...current,
          quantity: newQuantity
        }
      };
    });
  }

  function handleOrderSuccess() {
    setCart({}); // Clear cart on success
  }

  if (loading) {
    return (
      <div className="loading-screen" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <div className="spinner spinner-lg" />
        <p>Chargement du menu...</p>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="empty-state" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <h3 className="text-danger">Oups !</h3>
        <p>{error || 'Menu introuvable'}</p>
        <button className="btn btn-primary mt-md" onClick={() => navigate('/')}>
          Retour à l'accueil
        </button>
      </div>
    );
  }

  return (
    <>
      <TikTokFeed items={menuItems} onAddToCart={handleAddToCart} />
      <OrderCart 
        cart={cart} 
        restaurantId={restaurant.id}
        onCartUpdate={handleUpdateCart}
        onOrderSuccess={handleOrderSuccess}
      />
    </>
  );
}
