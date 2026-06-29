import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

export default function OrderCart({ cart, restaurantId, onCartUpdate, onOrderSuccess }) {
  const [isOpen, setIsOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const cartItems = Object.values(cart);
  const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  async function handleOrder() {
    if (!tableNumber) {
      toast.error('Veuillez saisir votre numéro de table');
      return;
    }

    if (totalItems === 0) {
      toast.error('Votre panier est vide');
      return;
    }

    setLoading(true);
    try {
      // 1. Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          restaurant_id: restaurantId,
          table_number: tableNumber,
          total: total,
          status: 'pending'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Create order items
      const itemsToInsert = cartItems.map(item => ({
        order_id: order.id,
        menu_item_id: item.id,
        quantity: item.quantity,
        price: item.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Update analytics
      cartItems.forEach(async (item) => {
        try {
          const { data } = await supabase
            .from('analytics')
            .select('id, orders_count')
            .eq('restaurant_id', restaurantId)
            .eq('menu_item_id', item.id)
            .single();

          if (data) {
            await supabase
              .from('analytics')
              .update({ orders_count: (data.orders_count || 0) + item.quantity })
              .eq('id', data.id);
          } else {
            await supabase
              .from('analytics')
              .insert({
                restaurant_id: restaurantId,
                menu_item_id: item.id,
                orders_count: item.quantity,
                views: 1
              });
          }
        } catch (e) {
          // Silent fail for analytics
        }
      });

      toast.success('Commande envoyée en cuisine !');
      setIsOpen(false);
      if (onOrderSuccess) onOrderSuccess();
      
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la commande');
    } finally {
      setLoading(false);
    }
  }

  if (totalItems === 0 && !isOpen) return null;

  return (
    <>
      {/* FAB Button */}
      {!isOpen && totalItems > 0 && (
        <button className="cart-fab animate-scale-in" onClick={() => setIsOpen(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          Panier
          <span className="badge-count" style={{ marginLeft: '4px' }}>{totalItems}</span>
        </button>
      )}

      {/* Cart Modal */}
      {isOpen && (
        <div className="cart-modal">
          <div className="cart-modal-backdrop" onClick={() => setIsOpen(false)} />
          <div className="cart-modal-content">
            <div className="cart-handle" />
            
            <div className="flex justify-between items-center mb-md">
              <h2 className="font-bold text-xl">Votre Commande</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsOpen(false)}>✕</button>
            </div>

            <div className="mb-md">
              <label className="form-label" htmlFor="table-number">Numéro de table *</label>
              <input
                id="table-number"
                type="text"
                className="form-input"
                placeholder="Ex: 12, Terrasse 3, A5..."
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
              />
            </div>

            <div className="order-items" style={{ maxHeight: '40vh', overflowY: 'auto' }}>
              {cartItems.length === 0 ? (
                <p className="text-center text-muted py-md">Votre panier est vide</p>
              ) : (
                cartItems.map(item => (
                  <div key={item.id} className="order-item-row" style={{ padding: '12px 0' }}>
                    <div className="flex-1">
                      <div className="font-bold">{item.name}</div>
                      <div className="text-muted text-sm">{item.price.toFixed(2)} FCFA / unité</div>
                    </div>
                    
                    <div className="flex items-center gap-sm">
                      <div className="flex items-center bg-input rounded-full px-2 py-1">
                        <button 
                          className="btn-ghost" 
                          style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}
                          onClick={() => onCartUpdate(item, -1)}
                        >
                          -
                        </button>
                        <span className="font-bold px-2 w-6 text-center">{item.quantity}</span>
                        <button 
                          className="btn-ghost" 
                          style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}
                          onClick={() => onCartUpdate(item, 1)}
                        >
                          +
                        </button>
                      </div>
                      <div className="font-bold w-16 text-right">
                        {(item.price * item.quantity).toFixed(2)} FCFA
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="order-footer mt-md pt-md">
              <span className="order-total text-xl">{total.toFixed(2)} FCFA</span>
              <button 
                className="btn btn-primary btn-lg" 
                onClick={handleOrder}
                disabled={loading || totalItems === 0 || !tableNumber}
              >
                {loading ? <span className="spinner" /> : 'Commander'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
