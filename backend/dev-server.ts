import 'dotenv/config';
import express from 'express';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import authAction from './api/auth/[action]';
import money from './api/money/index';
import moneyCategory from './api/money/category';
import moneyAccounts from './api/money/accounts';
import tasks from './api/tasks/index';
import tasksAction from './api/tasks/[action]';
import focus from './api/focus/index';
import focusApps from './api/focus/apps';
import focusAction from './api/focus/[action]';
import dashboardSummary from './api/dashboard/summary';

type Handler = (req: VercelRequest, res: VercelResponse) => unknown;

const app = express();
app.use(express.json());

function mount(path: string, handler: Handler) {
  app.all(path, (req, res) => {
    Object.assign(req.query, req.params);
    handler(req as unknown as VercelRequest, res as unknown as VercelResponse);
  });
}

mount('/api/auth/:action', authAction);
mount('/api/money', money);
mount('/api/money/category', moneyCategory);
mount('/api/money/accounts', moneyAccounts);
mount('/api/tasks', tasks);
mount('/api/tasks/:action', tasksAction);
mount('/api/focus', focus);
mount('/api/focus/apps', focusApps);
mount('/api/focus/:action', focusAction);
mount('/api/dashboard/summary', dashboardSummary);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Axon backend dev server listening on http://localhost:${port}`);
});
