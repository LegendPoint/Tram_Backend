import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import authRoutes from './routes/authRoutes.js';

// Load environment variables
config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());

// Routes
app.use('/api/auth', authRoutes);

// Home route
app.get('/', (req, res) => {
  res.send('Travel Simulation API is running...');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in development mode on port ${PORT}`);
});
