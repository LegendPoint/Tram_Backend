import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import stationRoutes from './routes/stationRoutes.js';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stations', stationRoutes);

// Home route
app.get('/', (req, res) => {
  res.send('Travel Simulation API is running...');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
