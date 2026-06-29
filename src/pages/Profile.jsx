import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';

export default function Profile() {
  const { user, restaurant, updateRestaurant, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [name, setName] = useState(restaurant?.name || '');
  const [loading, setLoading] = useState(false);

  async function handleUpdateProfile(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await updateRestaurant({ name: name.trim() });
      toast.success('Profil mis à jour');
    } catch (err) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Optional: add some basic validation (size, type)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('L\'image doit faire moins de 2 Mo');
      return;
    }

    try {
      toast.info('Téléchargement du logo...');
      
      const ext = file.name.split('.').pop();
      const fileName = `${restaurant.id}/logo_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      await updateRestaurant({ logo_url: publicUrl });
      toast.success('Logo mis à jour');
      
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'upload');
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      toast.error('Erreur de déconnexion');
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Profil Restaurant</h1>
      </div>

      <div className="card mb-lg">
        <div className="profile-upload mb-lg">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleLogoUpload}
            accept="image/*"
            style={{ display: 'none' }}
          />
          
          {restaurant?.logo_url ? (
            <img src={restaurant.logo_url} alt="Logo" className="profile-avatar" />
          ) : (
            <div className="profile-avatar flex items-center justify-center text-muted" style={{ fontSize: '32px' }}>
              🏢
            </div>
          )}
          
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => fileInputRef.current?.click()}
          >
            Changer le logo
          </button>
        </div>

        <form onSubmit={handleUpdateProfile}>
          <div className="form-group">
            <label className="form-label" htmlFor="profile-name">Nom du restaurant</label>
            <input
              id="profile-name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Email de connexion</label>
            <input
              type="email"
              className="form-input"
              value={user?.email || ''}
              disabled
              style={{ opacity: 0.6 }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Code unique (QR)</label>
            <input
              type="text"
              className="form-input font-bold text-accent"
              value={restaurant?.code || ''}
              disabled
              style={{ opacity: 0.8 }}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-full mt-sm"
            disabled={loading || name === restaurant?.name}
          >
            {loading ? <span className="spinner" /> : 'Enregistrer les modifications'}
          </button>
        </form>
      </div>

      <button 
        className="btn btn-danger btn-full btn-ghost" 
        onClick={handleSignOut}
      >
        Se déconnecter
      </button>
    </div>
  );
}
