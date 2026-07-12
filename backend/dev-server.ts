import 'dotenv/config';
import express from 'express';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import authSignup from './api/auth/signup';
import authLogin from './api/auth/login';
import authRefresh from './api/auth/refresh';
import authLogout from './api/auth/logout';
import money from './api/money/index';
import moneyCategory from './api/money/category';
import moneyAccounts from './api/money/accounts';
import tasks from './api/tasks/index';
import tasksStatus from './api/tasks/status';
import tasksTitle from './api/tasks/title';
import tasksDelete from './api/tasks/delete';
import focus from './api/focus/index';
import focusApps from './api/focus/apps';
import focusStreak from './api/focus/streak';
import focusUsage from './api/focus/usage';
import dashboardSummary from './api/dashboard/summary';

type Handler = (req: VercelRequest, res: VercelResponse) => unknown;

const app = express();
app.use(express.json());

function mount(path: string, handler: Handler) {
  app.all(path, (req, res) => handler(req as unknown as VercelRequest, res as unknown as VercelResponse));
}

mount('/api/auth/signup', authSignup);
mount('/api/auth/login', authLogin);
mount('/api/auth/refresh', authRefresh);
mount('/api/auth/logout', authLogout);
mount('/api/money', money);
mount('/api/money/category', moneyCategory);
mount('/api/money/accounts', moneyAccounts);
mount('/api/tasks', tasks);
mount('/api/tasks/status', tasksStatus);
mount('/api/tasks/title', tasksTitle);
mount('/api/tasks/delete', tasksDelete);
mount('/api/focus', focus);
mount('/api/focus/apps', focusApps);
mount('/api/focus/streak', focusStreak);
mount('/api/focus/usage', focusUsage);
mount('/api/dashboard/summary', dashboardSummary);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Axon backend dev server listening on http://localhost:${port}`);
});
