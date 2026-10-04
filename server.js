import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { generate } from './chatbot.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Welcome to ChatDPT!');
});

app.post('/chat', async (req, res) => {
    const { message, threadId } = req.body ?? {};

    if (typeof message !== 'string' || !message.trim() || !threadId) {
        return res.status(400).json({ message: 'All fields are required!' });
    }

    try {
        const result = await generate(message, threadId);
        res.json({ message: result });
    } catch (err) {
        console.error('Chat error:', err);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
});

// Catch-all error handler (e.g. malformed JSON bodies)
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const server = app.listen(port, () => {
    // console.log(`Server is running on port: ${port}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Stop the other process or change PORT.`);
    } else {
        console.error('Server error:', err);
    }
    process.exit(1);
});

// Keep the server alive on stray async errors, but log them
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
});
