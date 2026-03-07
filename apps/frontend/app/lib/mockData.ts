export const MOCK_BOUNTIES = [
  {
    id: 1,
    title: "Satellite Imagery Analysis",
    description:
      "Looking for high-resolution satellite imagery of deforestation in the Amazon rainforest from 2023-2024. Data must be in GeoTIFF format with proper metadata.",
    reward: "500 USDC",
    status: "active",
    participants: 3,
    deadline: "2024-04-01",
    requirements: [
      "Resolution: < 0.5m per pixel",
      "Format: GeoTIFF",
      "Metadata: Cloud cover < 10%",
      "Area: Amazon Basin (coordinates provided)",
    ],
    issuer: "0x1234...5678",
  },
  {
    id: 2,
    title: "Historical Weather Data",
    description:
      "Need daily temperature and precipitation records for major European cities from 1950 to 2000. CSV or JSON format preferred.",
    reward: "1000 USDC",
    status: "active",
    participants: 12,
    deadline: "2024-03-15",
    requirements: [
      "Timeframe: 1950-2000",
      "Frequency: Daily",
      "Variables: Min/Max Temp, Precipitation",
      "Cities: London, Paris, Berlin, Rome, Madrid",
    ],
    issuer: "0x8765...4321",
  },
  {
    id: 3,
    title: "AI Training Dataset - Traffic",
    description:
      "Collecting labeled images of urban traffic scenarios for autonomous driving model training. Minimum 10,000 images required.",
    reward: "2500 USDC",
    status: "active",
    participants: 8,
    deadline: "2024-05-20",
    requirements: [
      "Format: JPG/PNG",
      "Labels: YOLO format",
      "Scenarios: Day, Night, Rain",
      "Resolution: 1080p minimum",
    ],
    issuer: "0xabcd...ef01",
  },
  {
    id: 4,
    title: "Ocean Temperature Readings",
    description:
      "Pacific ocean surface temperature readings from buoy sensors. Dataset should cover Q1 2024.",
    reward: "300 USDC",
    status: "closed",
    participants: 5,
    deadline: "2024-02-01",
    requirements: [
      "Source: NOAA buoys",
      "Region: Pacific Ocean",
      "Format: NetCDF",
      "QC: Quality flags included",
    ],
    issuer: "0x9876...5432",
  },
];
