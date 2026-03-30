import { v4 as uuid } from 'uuid';

export const generateReceiptId = () => `RAYA-${uuid().split('-')[0].toUpperCase()}`;
