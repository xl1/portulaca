// @ts-check
import child_process from 'child_process';
import path from 'path';
import express from 'express';
import bodyParser from 'body-parser';

// @ts-ignore
import config from './portulaca.config.mjs';

const app = express();
app.use(bodyParser.json());
app.use(express.static('static'));

app.post('/api/git', (req, res) => {
    const proc = child_process.spawn('git', req.body.args, {
        cwd: config.directory
    });
    res.setHeader('content-type', 'text/plain');
    proc.stderr.on('data', () => res.status(400));
    proc.stdout.pipe(res);
    proc.stderr.pipe(res);
});

app.get('/config', (req, res) => {
    res.sendFile(path.resolve('./portulaca.config.mjs'), {
        headers: {
            'content-type': 'text/javascript'
        }
    });
});

app.listen(process.env.PORT || 8080);
