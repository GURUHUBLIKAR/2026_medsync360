import React, { useRef, useState } from 'react';
import {
  User,
  Palette,
  Bell,
  Shield,
  Camera,
  Loader2,
  Sun,
  Moon,
  Save,
  Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../../store/authStore';
import { usePreferences, type NotificationPrefs } from '../../../store/preferencesStore';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../ui/Button';
import { cn } from '../../../lib/utils';

const ROLE_OPTIONS = [
  'Intern', 'PG', 'Junior Resident', 'Senior Resident',
  'Consultant', 'Assistant Professor', 'Associate Professor', 'Professor', 'HOD',
];

type TabKey = 'profile' | 'appearance' | 'notifications' | 'security';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  { key: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
  { key: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { key: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
];

const inputClass =
  'w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label, hint, children,
}) => (
  <div>
    <label className="block text-sm font-medium text-neutral-700 mb-1.5">{label}</label>
    {children}
    {hint && <p className="text-xs text-neutral-500 mt-1">{hint}</p>}
  </div>
);

const Switch: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}> = ({ checked, onChange, label, description }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="flex items-center justify-between w-full py-3 text-left border-b border-neutral-100 last:border-0"
  >
    <span className="pr-4">
      <span className="block text-sm font-medium text-neutral-900">{label}</span>
      {description && <span className="block text-xs text-neutral-500 mt-0.5">{description}</span>}
    </span>
    <span
      className={cn(
        'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-primary-600' : 'bg-neutral-300'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </span>
  </button>
);

const SectionCard: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({
  title, description, children,
}) => (
  <div className="bg-white rounded-xl border border-neutral-200 p-5">
    <div className="mb-4">
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      {description && <p className="text-sm text-neutral-500 mt-0.5">{description}</p>}
    </div>
    {children}
  </div>
);

const Settings: React.FC = () => {
  const { profile, updateProfile } = useAuthStore();
  const [tab, setTab] = useState<TabKey>('profile');

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20 text-neutral-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-neutral-900">Settings</h1>
        <p className="text-sm text-neutral-600 mt-1">Manage your profile, appearance, and preferences.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tabs */}
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:w-56 flex-shrink-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                tab === t.key
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {tab === 'profile' && <ProfileSection profile={profile} updateProfile={updateProfile} />}
          {tab === 'appearance' && <AppearanceSection />}
          {tab === 'notifications' && <NotificationsSection />}
          {tab === 'security' && <SecuritySection />}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
const ProfileSection: React.FC<{
  profile: any;
  updateProfile: (u: any) => Promise<void>;
}> = ({ profile, updateProfile }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url || null);
  const [form, setForm] = useState({
    full_name: profile.full_name || '',
    role: profile.role || '',
    department: profile.department || '',
    kmc_number: profile.kmc_number || '',
    phone: profile.phone || '',
    year_of_graduation: profile.year_of_graduation ? String(profile.year_of_graduation) : '',
    currently_working_at: profile.currently_working_at || '',
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, cacheControl: '3600' });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      await updateProfile({ avatar_url: data.publicUrl });
      setAvatarUrl(data.publicUrl);
      toast.success('Photo updated');
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
      toast.error(
        err?.message?.includes('Bucket')
          ? 'Avatar storage bucket "avatars" is not set up yet.'
          : 'Could not upload photo'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        full_name: form.full_name.trim(),
        role: form.role || null,
        department: form.department.trim() || null,
        kmc_number: form.kmc_number.trim() || null,
        phone: form.phone.trim() || null,
        year_of_graduation: form.year_of_graduation ? Number(form.year_of_graduation) : null,
        currently_working_at: form.currently_working_at.trim() || null,
      });
      toast.success('Profile saved');
    } catch (err: any) {
      console.error('Profile save failed:', err);
      toast.error(err?.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const initials = (form.full_name || 'U')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      <SectionCard title="Profile photo" description="Shown across the app and on your dashboard.">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-primary-100 border-2 border-primary-200 flex items-center justify-center flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-primary-700">{initials}</span>
            )}
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
              {uploading ? 'Uploading…' : 'Change photo'}
            </Button>
            <p className="text-xs text-neutral-500 mt-2">JPG or PNG, up to ~5MB.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Personal information" description="Keep your professional details up to date.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full name">
            <input className={inputClass} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
          </Field>
          <Field label="Email" hint="Email changes are managed under Security.">
            <input className={cn(inputClass, 'bg-neutral-50 cursor-not-allowed text-neutral-500')} value={profile.email || ''} disabled />
          </Field>
          <Field label="Role">
            <select className={inputClass} value={form.role} onChange={(e) => set('role', e.target.value)}>
              <option value="">Select role</option>
              {(ROLE_OPTIONS.includes(form.role) || !form.role ? ROLE_OPTIONS : [form.role, ...ROLE_OPTIONS]).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Department">
            <input className={inputClass} value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="e.g. MD General Medicine" />
          </Field>
          <Field label="KMC number">
            <input className={inputClass} value={form.kmc_number} onChange={(e) => set('kmc_number', e.target.value)} placeholder="KMC123456" />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Year of graduation">
            <input type="number" className={inputClass} value={form.year_of_graduation} onChange={(e) => set('year_of_graduation', e.target.value)} min={1950} max={2100} />
          </Field>
          <Field label="Currently working at">
            <input className={inputClass} value={form.currently_working_at} onChange={(e) => set('currently_working_at', e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end mt-5">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save changes
          </Button>
        </div>
      </SectionCard>
    </>
  );
};

// ---------------------------------------------------------------------------
// Appearance
// ---------------------------------------------------------------------------
const AppearanceSection: React.FC = () => {
  const { theme, setTheme } = usePreferences();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  );

  const updateSidebarDefault = (v: boolean) => {
    setSidebarCollapsed(v);
    try { localStorage.setItem('sidebar-collapsed', String(v)); } catch { /* ignore */ }
  };

  return (
    <>
      <SectionCard title="Theme" description="Choose how MedSync 360 looks.">
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          {([
            { key: 'light', label: 'Light (Mint)', icon: <Sun className="w-4 h-4" /> },
            { key: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
          ] as const).map((o) => (
            <button
              key={o.key}
              onClick={() => setTheme(o.key)}
              className={cn(
                'flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors',
                theme === o.key
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
              )}
            >
              {o.icon}
              {o.label}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Layout">
        <Switch
          checked={sidebarCollapsed}
          onChange={updateSidebarDefault}
          label="Start with sidebar collapsed"
          description="Applies the next time the app loads."
        />
      </SectionCard>
    </>
  );
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
const NotificationsSection: React.FC = () => {
  const { notifications, setNotification } = usePreferences();
  const items: { key: keyof NotificationPrefs; label: string; description: string }[] = [
    { key: 'inApp', label: 'In-app notifications', description: 'Show the bell badge and dropdown alerts.' },
    { key: 'dutySwap', label: 'Duty swap alerts', description: 'Notify me when a duty is swapped or assigned.' },
    { key: 'referrals', label: 'Referral updates', description: 'New, accepted, declined or transferred referrals.' },
    { key: 'sound', label: 'Notification sound', description: 'Play a sound for new notifications.' },
  ];
  return (
    <SectionCard title="Notifications" description="Saved on this device.">
      {items.map((it) => (
        <Switch
          key={it.key}
          checked={notifications[it.key]}
          onChange={(v) => setNotification(it.key, v)}
          label={it.label}
          description={it.description}
        />
      ))}
    </SectionCard>
  );
};

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------
const SecuritySection: React.FC = () => {
  const { sessionTimeoutEnabled, setSessionTimeoutEnabled } = usePreferences();
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePassword = async () => {
    if (pwd.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (pwd !== confirm) { toast.error('Passwords do not match'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      toast.success('Password updated');
      setPwd('');
      setConfirm('');
    } catch (err: any) {
      console.error('Password change failed:', err);
      toast.error(err?.message || 'Could not update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionCard title="Change password" description="Use at least 8 characters.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <Field label="New password">
            <input type="password" className={inputClass} value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirm password">
            <input type="password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
        </div>
        <div className="flex justify-end mt-5">
          <Button onClick={handlePassword} disabled={saving || !pwd}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
            Update password
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Session" description="Protect your account on shared devices.">
        <Switch
          checked={sessionTimeoutEnabled}
          onChange={setSessionTimeoutEnabled}
          label="Idle session timeout"
          description="Automatically log out after a period of inactivity, with a warning first."
        />
      </SectionCard>
    </>
  );
};

export default React.memo(Settings);
export { Settings };
