import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useRealtimeOrders } from '../hooks/useRealtimeOrders';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const { restaurant } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ todayRevenue: 0, todayOrders: 0, pendingOrders: 0 });
  const [topViewed, setTopViewed] = useState([]);
  const [topOrdered, setTopOrdered] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(true);

  const handleNewOrder = useCallback((newOrder) => {
    toast.success(`Nouvelle commande — Table ${newOrder.table_number}`);
    fetchOrders();
    fetchStats();
  }, [toast]);

  useRealtimeOrders(handleNewOrder);

  useEffect(() => {
    if (restaurant?.id) {
      fetchOrders();
      fetchStats();
      fetchTopItems();
    }
  }, [restaurant?.id]);

  async function fetchOrders() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            menu_item:menu_items (name)
          )
        `)
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: todayOrders } = await supabase
        .from('orders')
        .select('total, status')
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', today.toISOString());

      if (todayOrders) {
        const delivered = todayOrders.filter(o => o.status === 'delivered');
        const pending = todayOrders.filter(o => o.status === 'pending');

        setStats({
          todayRevenue: delivered.reduce((sum, o) => sum + (o.total || 0), 0),
          todayOrders: todayOrders.length,
          pendingOrders: pending.length
        });
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }

  async function fetchTopItems() {
    try {
      // Top ordered - aggregate from order_items
      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`
          quantity,
          menu_item:menu_items!inner (
            id, name, restaurant_id
          )
        `)
        .eq('menu_item.restaurant_id', restaurant.id);

      if (orderItems) {
        const itemCounts = {};
        orderItems.forEach(oi => {
          const name = oi.menu_item?.name;
          if (name) {
            itemCounts[name] = (itemCounts[name] || 0) + (oi.quantity || 1);
          }
        });

        const sorted = Object.entries(itemCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }));

        setTopOrdered(sorted);
      }

      // Top viewed
      const { data: analytics } = await supabase
        .from('analytics')
        .select(`
          views,
          menu_item:menu_items (name)
        `)
        .eq('restaurant_id', restaurant.id)
        .order('views', { ascending: false })
        .limit(5);

      if (analytics) {
        setTopViewed(analytics.map(a => ({
          name: a.menu_item?.name || 'Inconnu',
          count: a.views || 0
        })));
      }
    } catch (err) {
      console.error('Error fetching top items:', err);
    }
  }

  async function updateOrderStatus(orderId, newStatus) {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(prev =>
        prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
      );

      toast.success(newStatus === 'delivered' ? 'Commande livrée !' : 'Statut mis à jour');
      fetchStats();
    } catch (err) {
      toast.error('Erreur lors de la mise à jour');
    }
  }

  const filteredOrders = orders.filter(o => {
    if (activeTab === 'pending') return o.status === 'pending';
    if (activeTab === 'delivered') return o.status === 'delivered';
    return true;
  });

  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getRankClass(index) {
    if (index === 0) return 'top-rank-1';
    if (index === 1) return 'top-rank-2';
    if (index === 2) return 'top-rank-3';
    return 'top-rank-default';
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg" />
        <p>Chargement du tableau de bord...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Tableau de bord</h1>
        <p className="page-subtitle">{restaurant?.name || 'Mon restaurant'}</p>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-value">{stats.todayRevenue.toFixed(2)} FCFA</div>
          <div className="kpi-label">CA du jour</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{stats.todayOrders}</div>
          <div className="kpi-label">Commandes</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: stats.pendingOrders > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {stats.pendingOrders}
          </div>
          <div className="kpi-label">En attente</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{topOrdered[0]?.name?.slice(0, 10) || '—'}</div>
          <div className="kpi-label">Top plat</div>
        </div>
      </div>

      {/* Orders tabs */}
      <div className="tab-bar">
        <button
          className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          En attente ({orders.filter(o => o.status === 'pending').length})
        </button>
        <button
          className={`tab ${activeTab === 'delivered' ? 'active' : ''}`}
          onClick={() => setActiveTab('delivered')}
        >
          Livrées ({orders.filter(o => o.status === 'delivered').length})
        </button>
        <button
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          Toutes
        </button>
      </div>

      {/* Orders list */}
      {filteredOrders.length === 0 ? (
        <div className="empty-state">
          <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3>Aucune commande</h3>
          <p>Les nouvelles commandes apparaîtront ici en temps réel</p>
        </div>
      ) : (
        filteredOrders.map(order => (
          <div key={order.id} className="order-card">
            <div className="order-header">
              <div>
                <span className="order-table">Table {order.table_number}</span>
                <span className="order-time" style={{ marginLeft: '12px' }}>{formatTime(order.created_at)}</span>
              </div>
              <span className={`badge ${order.status === 'pending' ? 'badge-pending' : 'badge-delivered'}`}>
                {order.status === 'pending' ? '⏳ En attente' : '✓ Livré'}
              </span>
            </div>

            <div className="order-items">
              {order.order_items?.map((item, idx) => (
                <div key={idx} className="order-item-row">
                  <span className="order-item-name">
                    {item.menu_item?.name || 'Plat'}
                    <span className="order-item-qty"> × {item.quantity}</span>
                  </span>
                  <span className="order-item-price">{(item.price * item.quantity).toFixed(2)} FCFA</span>
                </div>
              ))}
            </div>

            <div className="order-footer">
              <span className="order-total">{(order.total || 0).toFixed(2)} FCFA</span>
              {order.status === 'pending' && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => updateOrderStatus(order.id, 'delivered')}
                >
                  ✓ Marquer livré
                </button>
              )}
              {order.status === 'delivered' && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => updateOrderStatus(order.id, 'pending')}
                >
                  ↩ Annuler
                </button>
              )}
            </div>
          </div>
        ))
      )}

      {/* Analytics section */}
      {(topOrdered.length > 0 || topViewed.length > 0) && (
        <div style={{ marginTop: 'var(--space-xl)' }}>
          {topOrdered.length > 0 && (
            <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
              <h3 className="section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
                </svg>
                Top plats commandés
              </h3>
              <div className="top-list">
                {topOrdered.map((item, idx) => (
                  <div key={idx} className="top-item">
                    <span className={`top-rank ${getRankClass(idx)}`}>{idx + 1}</span>
                    <div className="top-item-info">
                      <div className="top-item-name">{item.name}</div>
                      <div className="top-item-stat">{item.count} commandes</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topViewed.length > 0 && (
            <div className="card">
              <h3 className="section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Top plats les plus vus
              </h3>
              <div className="top-list">
                {topViewed.map((item, idx) => (
                  <div key={idx} className="top-item">
                    <span className={`top-rank ${getRankClass(idx)}`}>{idx + 1}</span>
                    <div className="top-item-info">
                      <div className="top-item-name">{item.name}</div>
                      <div className="top-item-stat">{item.count} vues</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
