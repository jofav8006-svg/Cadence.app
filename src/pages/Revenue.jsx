import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function Revenue() {
  const { restaurant } = useAuth();
  const [period, setPeriod] = useState('today'); // today, week, month
  const [revenue, setRevenue] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (restaurant?.id) {
      fetchRevenueData();
    }
  }, [restaurant?.id, period]);

  async function fetchRevenueData() {
    setLoading(true);
    try {
      const now = new Date();
      let startDate = new Date();
      
      if (period === 'today') {
        startDate.setHours(0, 0, 0, 0);
      } else if (period === 'week') {
        startDate.setDate(now.getDate() - 7);
      } else if (period === 'month') {
        startDate.setMonth(now.getMonth() - 1);
      }

      // Only count DELIVERED orders for revenue
      const { data: orders, error } = await supabase
        .from('orders')
        .select('total, created_at')
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'delivered')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!orders || orders.length === 0) {
        setRevenue(0);
        setOrdersCount(0);
        setChartData([]);
        return;
      }

      // Calculate totals
      const totalRev = orders.reduce((sum, order) => sum + (order.total || 0), 0);
      setRevenue(totalRev);
      setOrdersCount(orders.length);

      // Group for chart
      const grouped = {};
      
      orders.forEach(order => {
        const date = new Date(order.created_at);
        let key;
        let label;
        
        if (period === 'today') {
          key = date.getHours().toString();
          label = `${key}h`;
        } else {
          key = date.toISOString().split('T')[0];
          label = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        }
        
        if (!grouped[key]) {
          grouped[key] = { label, total: 0 };
        }
        grouped[key].total += order.total || 0;
      });

      // Format for chart and calculate max for scaling
      const chartItems = Object.values(grouped);
      const maxVal = Math.max(...chartItems.map(item => item.total), 1);
      
      setChartData(chartItems.map(item => ({
        ...item,
        heightPercentage: (item.total / maxVal) * 100
      })));

    } catch (err) {
      console.error('Error fetching revenue:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading && chartData.length === 0) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg" />
        <p>Calcul des revenus...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Chiffre d'Affaires</h1>
      </div>

      <div className="tab-bar">
        <button 
          className={`tab ${period === 'today' ? 'active' : ''}`}
          onClick={() => setPeriod('today')}
        >
          Aujourd'hui
        </button>
        <button 
          className={`tab ${period === 'week' ? 'active' : ''}`}
          onClick={() => setPeriod('week')}
        >
          7 derniers jours
        </button>
        <button 
          className={`tab ${period === 'month' ? 'active' : ''}`}
          onClick={() => setPeriod('month')}
        >
          30 derniers jours
        </button>
      </div>

      <div className="card revenue-total">
        <div className="revenue-amount">{revenue.toFixed(2)} FCFA</div>
        <div className="revenue-period">
          {ordersCount} commande{ordersCount > 1 ? 's' : ''} payée{ordersCount > 1 ? 's' : ''}
        </div>
      </div>

      {chartData.length > 0 ? (
        <div className="card mt-lg">
          <h3 className="font-bold text-sm mb-md text-muted">ÉVOLUTION</h3>
          <div className="bar-chart">
            {chartData.map((data, idx) => (
              <div key={idx} className="bar-col">
                <div className="bar-value">{data.total > 0 ? Math.round(data.total) : ''}</div>
                <div 
                  className="bar" 
                  style={{ height: `${Math.max(data.heightPercentage, 4)}%` }}
                ></div>
                <div className="bar-label">{data.label}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state mt-lg">
          <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          <p>Aucun revenu validé sur cette période</p>
          <p className="text-xs text-muted mt-sm">Seules les commandes marquées comme "Livrées" sont comptabilisées.</p>
        </div>
      )}
    </div>
  );
}
