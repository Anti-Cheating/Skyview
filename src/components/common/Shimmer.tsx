import { Box, Card, CardContent, keyframes } from '@mui/material';

const shimmerAnimation = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const shimmerBg = {
  background: 'linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 37%, #F3F4F6 63%)',
  backgroundSize: '200% 100%',
  animation: `${shimmerAnimation} 1.5s ease-in-out infinite`,
  borderRadius: '8px',
};

export function ShimmerBlock({
  width = '100%',
  height = 16,
  borderRadius = '8px',
  sx = {},
}: {
  width?: string | number;
  height?: number;
  borderRadius?: string;
  sx?: object;
}) {
  return (
    <Box sx={{ ...shimmerBg, width, height, borderRadius, ...sx }} />
  );
}

export function StatCardShimmer() {
  return (
    <Card elevation={0} sx={{ borderRadius: '16px', border: '1px solid #E5E7EB', bgcolor: '#FFFFFF', height: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <ShimmerBlock width={56} height={56} borderRadius="12px" />
        </Box>
        <ShimmerBlock width={60} height={36} sx={{ mb: 1 }} borderRadius="8px" />
        <ShimmerBlock width={120} height={14} />
      </CardContent>
    </Card>
  );
}

export function WelcomeBannerShimmer() {
  return (
    <Box sx={{ mb: 4, p: 3, borderRadius: '16px', border: '1px solid', borderColor: '#E5E7EB', bgcolor: '#FAFAFA' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <ShimmerBlock width={56} height={56} borderRadius="14px" />
        <Box sx={{ flex: 1 }}>
          <ShimmerBlock width="60%" height={22} sx={{ mb: 1.5 }} />
          <ShimmerBlock width="90%" height={14} sx={{ mb: 0.5 }} />
          <ShimmerBlock width="70%" height={14} />
        </Box>
      </Box>
    </Box>
  );
}

export function DashboardShimmer() {
  return (
    <Box sx={{ p: 3 }}>
      <ShimmerBlock width={140} height={24} sx={{ mb: 3 }} />
      <WelcomeBannerShimmer />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3 }}>
        <StatCardShimmer />
        <StatCardShimmer />
        <StatCardShimmer />
      </Box>
    </Box>
  );
}

export function InterviewCardShimmer() {
  return (
    <Card elevation={0} sx={{ borderRadius: '16px', border: '1px solid #E5E7EB', bgcolor: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <ShimmerBlock width="55%" height={18} />
          <ShimmerBlock width={70} height={24} borderRadius="12px" />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {[...Array(3)].map((_, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShimmerBlock width={20} height={20} borderRadius="4px" />
              <ShimmerBlock width={`${35 + i * 5}%`} height={14} />
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <ShimmerBlock width={100} height={36} borderRadius="8px" />
        </Box>
      </CardContent>
    </Card>
  );
}

export function InterviewListShimmer({ count = 3 }: { count?: number }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
      {Array.from({ length: count }).map((_, i) => (
        <InterviewCardShimmer key={i} />
      ))}
    </Box>
  );
}
