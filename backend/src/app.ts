import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app: Application = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Backend is healthy' });
});

export default app;
