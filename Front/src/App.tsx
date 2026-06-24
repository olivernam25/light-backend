import { useState, useEffect } from 'react';
import {
  Box, CssBaseline, ThemeProvider, createTheme,
  Typography, Drawer, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Toolbar, Card, CardContent,
  Switch, Divider, Grid,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Settings as SettingsIcon,
  Lightbulb as LightbulbIcon,
  Circle as CircleIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
const API_URL = 'http://192.168.110.36:8800';

type ThemeConfig = {
  mode: 'light' | 'dark';
  mauChinh: string;
  mauNen: string;
  mauPaper: string;
};

const danhSachTheme: { [key: string]: ThemeConfig } = {
  'Classic Light': { mode: 'light', mauChinh: '#1976d2', mauNen: '#f8f9fc', mauPaper: '#ffffff' },
  'Deep Night':    { mode: 'dark',  mauChinh: '#90caf9', mauNen: '#0f0f1a', mauPaper: '#1a1a2e' },
  'Cyberpunk':     { mode: 'dark',  mauChinh: '#ff00ff', mauNen: '#1a0033', mauPaper: '#2d005d' },
  'Nature':        { mode: 'dark',  mauChinh: '#81c784', mauNen: '#0d1f17', mauPaper: '#1b4332' },
  'Ocean':         { mode: 'dark',  mauChinh: '#4fc3f7', mauNen: '#001d3d', mauPaper: '#002d5a' },
};

type LuxRecord = {
  id: number;
  time: string;
  lux: number;
};

// =============================================
// DASHBOARD (Đã bỏ Responsive)
// =============================================
function Dashboard() {
  const [duLieu, setDuLieu]         = useState<LuxRecord[]>([]);
  const [luxHienTai, setLuxHienTai] = useState<number | null>(null);
  const [dangBat, setDangBat]       = useState<boolean>(true);
  const [loi, setLoi]               = useState<string | null>(null);

  async function fetchLux() {
    try {
      const res = await fetch(`${API_URL}/lux`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LuxRecord[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setDuLieu(data);
        setLuxHienTai(data[data.length - 1].lux);
        setLoi(null);
      }
    } catch (err) {
      setLoi('Không thể kết nối server');
    }
  }

  useEffect(() => {
    fetchLux();
  }, []);

  useEffect(() => {
    if (!dangBat) return;
    const timer = setInterval(fetchLux, 3000);
    return () => clearInterval(timer);
  }, [dangBat]);

  return (
    <Box sx={{ width: '100%', minWidth: '900px' }}> {/* Cố định min-width để tránh vỡ layout máy tính */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Real-time Dashboard</Typography>
        {loi && <Typography variant="body2" color="error">{loi}</Typography>}
      </Box>

      {/* Cố định tỷ lệ các cột trên 1 hàng */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        
        {/* Card Chỉ số Lux - Chiếm 7/12 chiều rộng */}
        <Grid size ={7}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 4, height: '100%' }}>
              <Box sx={{ mr: 5, minWidth: 200 }}>
                <Typography variant="h2" color="primary.main" sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                  {dangBat && luxHienTai !== null ? luxHienTai : 'N/A'}{' '}
                  <Typography component="span" variant="h4" sx={{ opacity: 0.5 }}>Lux</Typography>
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ letterSpacing: 1 }}>
                  {dangBat ? 'SENSOR ACTIVE' : 'SENSOR STANDBY'}
                </Typography>
              </Box>
              <Box sx={{ flexGrow: 1, height: 120 }}>
                {dangBat && duLieu.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={duLieu}>
                      <Area type="monotone" dataKey="lux"
                        stroke="#1976d2" fill="none" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Card Trạng thái - Chiếm 2.5/12 chiều rộng */}
        <Grid size={2.5}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', p: 3 }}>
            <Typography variant="overline" color="text.secondary">System Status</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
              <CircleIcon sx={{
                color: dangBat && !loi ? 'success.main' : 'error.main',
                mr: 1.5, fontSize: 24,
              }} />
              <Typography variant="h5" sx={{ fontWeight: 600 }}>{dangBat && !loi ? 'Online' : 'Offline'}</Typography>
            </Box>
          </Card>
        </Grid>

        {/* Card Điều khiển - Chiếm 2.5/12 chiều rộng */}
        <Grid size ={2.5}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', p: 3 }}>
            <Typography variant="overline" color="text.secondary">Hardware Control</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>{dangBat ? 'ON' : 'OFF'}</Typography>
              <Switch
                checked={dangBat}
                onChange={(e) => setDangBat(e.target.checked)}
                color="primary"
              />
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Card Biểu đồ lịch sử */}
      <Card sx={{ p: 4, minHeight: 500 }}>
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}> History (Real-time Timeline)</Typography>
        <Box sx={{ height: 400 }}>
          {dangBat && duLieu.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={duLieu}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="time" hide />
                <YAxis axisLine={false} tickLine={false} unit=" lx" />
                <Tooltip />
                <Area type="monotone" dataKey="lux"
                  stroke="#1976d2" fill="rgba(25, 118, 210, 0.1)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Box sx={{
              height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              bgcolor: 'action.hover', borderRadius: 2,
            }}>
              <LightbulbIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography variant="h6" color="text.disabled">
                {!dangBat ? 'Sensor Offline' : loi ? 'Không có dữ liệu' : 'Đang tải...'}
              </Typography>
            </Box>
          )}
        </Box>
      </Card>
    </Box>
  );
}

// =============================================
// SETTINGS (Cố định lưới Theme)
// =============================================
type SettingsProps = {
  themeHienTai: string;
  khiDoiTheme: (ten: string) => void;
};

function Settings({ themeHienTai, khiDoiTheme }: SettingsProps) {
  const cacTheme = [
    { ten: 'Classic Light', mau: '#ffffff',  moTa: 'Clean and professional' },
    { ten: 'Deep Night',    mau: '#1a1a2e',  moTa: 'Easy on the eyes' },
    { ten: 'Cyberpunk',     mau: '#2d005d',  moTa: 'High contrast neon' },
    { ten: 'Nature',        mau: '#1b4332',  moTa: 'Calm forest vibes' },
    { ten: 'Ocean',         mau: '#0077b6',  moTa: 'Deep blue serenity' },
  ];

  return (
    <Box sx={{ minWidth: '900px' }}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>Appearance</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Customize your dashboard experience
      </Typography>
      
      {/* Sử dụng xs={2.4} để luôn hiển thị 5 item trên một hàng (12 / 5 = 2.4) */}
      <Grid container spacing={3}>
        {cacTheme.map((theme, viTri) => {
          const dangChon = themeHienTai === theme.ten;
          return (
            <Grid size ={2.4} key={viTri}>
              <Card
                onClick={() => khiDoiTheme(theme.ten)}
                sx={{
                  cursor: 'pointer',
                  border: dangChon ? '2px solid' : '1px solid',
                  borderColor: dangChon ? 'primary.main' : 'divider',
                  transition: '0.2s',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
                }}
              >
                <Box sx={{ height: 120, bgcolor: theme.mau, position: 'relative' }}>
                  {dangChon && (
                    <Box sx={{
                      position: 'absolute', top: 8, right: 8,
                      bgcolor: 'primary.main', borderRadius: '50%', display: 'flex',
                    }}>
                      <CheckCircleIcon sx={{ color: 'white', fontSize: 20 }} />
                    </Box>
                  )}
                </Box>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{theme.ten}</Typography>
                  <Typography variant="caption" color="text.secondary">{theme.moTa}</Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

// =============================================
// APP (Cố định Sidebar)
// =============================================
const RONG_SIDEBAR = 260;

export default function App() {
  const [tabHienTai, setTabHienTai] = useState<string>('dashboard');
  const [tenTheme,   setTenTheme]   = useState<string>('Classic Light');

  const cauHinhTheme = danhSachTheme[tenTheme];

  const theme = createTheme({
    palette: {
      mode: cauHinhTheme.mode,
      primary: { main: cauHinhTheme.mauChinh },
      background: {
        default: cauHinhTheme.mauNen,
        paper:   cauHinhTheme.mauPaper,
      },
    },
    typography: {
      fontFamily: '"Inter", "Segoe UI", sans-serif',
    },
    components: {
      MuiDrawer: {
        styleOverrides: {
          paper: {
            width: RONG_SIDEBAR,
            boxSizing: 'border-box',
            backgroundColor: cauHinhTheme.mauPaper,
            borderRight: '1px solid rgba(0,0,0,0.08)'
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            margin: '4px 8px',
            '&.Mui-selected': {
              backgroundColor: cauHinhTheme.mauChinh,
              color: 'white',
              '& .MuiListItemIcon-root': { color: 'white' },
              '&:hover': { backgroundColor: cauHinhTheme.mauChinh },
            },
          },
        },
      },
    },
  });

  const cacMucNav = [
    { id: 'dashboard', nhan: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'settings',  nhan: 'Settings',  icon: <SettingsIcon /> },
  ];

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        <CssBaseline />

        {/* Sidebar luôn hiện cố định bên trái */}
        <Drawer variant="permanent" sx={{ width: RONG_SIDEBAR, flexShrink: 0 }}>
          <Toolbar sx={{ my: 2, px: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <LightbulbIcon color="primary" sx={{ fontSize: 32 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>LightSense</Typography>
            </Box>
          </Toolbar>
          <Divider sx={{ opacity: 0.6 }} />
          <List sx={{ px: 1, mt: 2 }}>
            {cacMucNav.map((muc) => (
              <ListItem key={muc.id} disablePadding>
                <ListItemButton
                  selected={tabHienTai === muc.id}
                  onClick={() => setTabHienTai(muc.id)}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>{muc.icon}</ListItemIcon>
                  <ListItemText 
                    primary={muc.nhan} 
                    primaryTypographyProps={{ fontWeight: tabHienTai === muc.id ? 600 : 400 }} 
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Drawer>

        {/* Nội dung chính */}
        <Box component="main" sx={{ flexGrow: 1, p: 5, overflowX: 'auto' }}>
          {tabHienTai === 'dashboard'
            ? <Dashboard />
            : <Settings themeHienTai={tenTheme} khiDoiTheme={setTenTheme} />
          }
        </Box>
      </Box>
    </ThemeProvider>
  );
}
