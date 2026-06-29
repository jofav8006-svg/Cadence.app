import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';

export default function AddEditDish() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { restaurant } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState([]);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState('image');
  const [existingPhotoUrl, setExistingPhotoUrl] = useState('');
  const [existingVideoUrl, setExistingVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);

  useEffect(() => {
    fetchCategories();
    if (isEdit) fetchDish();
  }, []);

  async function fetchCategories() {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order');
    setCategories(data || []);
  }

  async function fetchDish() {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setName(data.name);
        setPrice(data.price?.toString() || '');
        setCategoryId(data.category_id || '');
        setDescription(data.description || '');
        setExistingPhotoUrl(data.photo_url || '');
        setExistingVideoUrl(data.video_url || '');
      }
    } catch (err) {
      toast.error('Plat introuvable');
      navigate('/menu');
    } finally {
      setLoadingData(false);
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    setMediaType(isVideo ? 'video' : 'image');
    setMediaFile(file);

    // Create preview
    const url = URL.createObjectURL(file);
    setMediaPreview(url);
  }

  function removeMedia() {
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function cropImageTo916(file) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetRatio = 9 / 16;
        let sw, sh, sx, sy;

        const imgRatio = img.width / img.height;

        if (imgRatio > targetRatio) {
          // Image is wider - crop width
          sh = img.height;
          sw = img.height * targetRatio;
          sx = (img.width - sw) / 2;
          sy = 0;
        } else {
          // Image is taller - crop height
          sw = img.width;
          sh = img.width / targetRatio;
          sx = 0;
          sy = (img.height - sh) / 2;
        }

        // Max resolution 1080x1920
        canvas.width = Math.min(sw, 1080);
        canvas.height = Math.min(sh, 1920);

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.85);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  async function uploadMedia(file) {
    const ext = file.name.split('.').pop();
    const fileName = `${restaurant.id}/${Date.now()}.${ext}`;
    const bucket = mediaType === 'video' ? 'videos' : 'photos';

    let uploadFile = file;
    if (mediaType === 'image') {
      uploadFile = await cropImageTo916(file);
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, uploadFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrl;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!name || !price) {
      toast.error('Le nom et le prix sont requis');
      return;
    }

    setLoading(true);
    try {
      let photoUrl = existingPhotoUrl;
      let videoUrl = existingVideoUrl;

      if (mediaFile) {
        const url = await uploadMedia(mediaFile);
        if (mediaType === 'image') {
          photoUrl = url;
        } else {
          videoUrl = url;
        }
      }

      const dishData = {
        restaurant_id: restaurant.id,
        name: name.trim(),
        price: parseFloat(price),
        category_id: categoryId || null,
        description: description.trim(),
        photo_url: photoUrl,
        video_url: videoUrl,
        is_active: true
      };

      if (isEdit) {
        const { error } = await supabase
          .from('menu_items')
          .update(dishData)
          .eq('id', id);
        if (error) throw error;
        toast.success('Plat modifié avec succès');
      } else {
        const { error } = await supabase
          .from('menu_items')
          .insert(dishData);
        if (error) throw error;
        toast.success('Plat ajouté au menu !');
      }

      navigate('/menu');
    } catch (err) {
      toast.error(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  }

  if (loadingData) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg" />
        <p>Chargement...</p>
      </div>
    );
  }

  const currentPreview = mediaPreview || existingPhotoUrl || existingVideoUrl;

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center gap-md">
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/menu')}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="page-title">{isEdit ? 'Modifier le plat' : 'Nouveau plat'}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Media upload */}
        <div className="form-group">
          <label className="form-label">Photo ou vidéo (format 9:16)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {currentPreview ? (
            <div className="upload-preview">
              {(mediaType === 'video' || existingVideoUrl) && !mediaPreview ? (
                <video src={existingVideoUrl} controls />
              ) : mediaType === 'video' && mediaPreview ? (
                <video src={mediaPreview} controls />
              ) : (
                <img src={mediaPreview || existingPhotoUrl} alt="Aperçu" />
              )}
              <button type="button" className="upload-preview-remove" onClick={removeMedia}>✕</button>
            </div>
          ) : (
            <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              <p>Touchez pour ajouter une photo ou vidéo</p>
              <p className="text-xs text-muted" style={{ marginTop: '4px' }}>
                Recadrage automatique en 9:16
              </p>
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="dish-name">Nom du plat *</label>
          <input
            id="dish-name"
            type="text"
            className="form-input"
            placeholder="Ex: Couscous Royal"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="dish-price">Prix (FCFA) *</label>
          <input
            id="dish-price"
            type="number"
            step="0.01"
            min="0"
            className="form-input"
            placeholder="12.50"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="dish-category">Catégorie</label>
          <select
            id="dish-category"
            className="form-input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Sans catégorie</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="dish-description">Description (optionnelle)</label>
          <textarea
            id="dish-description"
            className="form-input"
            placeholder="Une brève description du plat..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-full btn-lg"
          disabled={loading}
          id="save-dish-btn"
        >
          {loading ? <span className="spinner" /> : isEdit ? 'Enregistrer les modifications' : 'Ajouter au menu'}
        </button>
      </form>
    </div>
  );
}
