import Vue from 'https://cdnjs.cloudflare.com/ajax/libs/vue/2.5.17/vue.esm.browser.js';
import config from './config';

function git(...args) {
    return fetch('/api/git', {
        method: 'POST',
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify({ args })
    });
}

const vMenu = new Vue({
    el: '#menu',
    data: {
        directory: config.directory,
        branch: ''
    },
    methods: {
        sync() {
            return Promise.all([
                this.fetch(),
                this.updateBranchName(),
                vList.load()
            ]);
        },
        fetch() {
            return git('fetch').then(r => r.text());
        },
        async updateBranchName() {
            const res = await git('symbolic-ref', '--short', 'head');
            if (res.status === 200) {
                this.branch = (await res.text()).trim();
            } else {
                const text = await git('rev-parse', '--short', 'head').then(r => r.text());
                this.branch = `(${text.trim()})`;
            }
        }
    },
    created() {
        return Promise.all([
            this.fetch(),
            this.updateBranchName()
        ]);
    }
});

const vList = new Vue({
    el: '#list',
    data: {
        items: []
    },
    methods: {
        async checkout(branch) {
            await git('checkout', branch);
            await vMenu.updateBranchName();
        },
        async load() {
            const tasks = config.branches.map(async (branch) => {
                const res = await git(
                    'log',
                    '-1',
                    '--date=iso',
                    '--pretty=format:{"commitHash":"%h","authorName":"%an","authorDate":"%ad"}',
                    branch.name
                ).then(r => r.json());
                const branchesText = await git(
                    'log',
                    '--merges',
                    '--pretty=%s',
                    `${config.defaultBranch}..${branch.name}`
                ).then(r => r.text());
                const branches = branchesText.split('\n').map(line => {
                    let m;
                    if (m = /branch '(.+?)'/.exec(line)) {
                        return m[1];
                    }
                    if (m = /pull request (#\d+)/.exec(line)) {
                        return m[1];
                    }
                    return null;
                }).filter(Boolean);
                return {
                    target: branch.name,
                    commit: res.commitHash,
                    date: res.authorDate,
                    author: res.authorName,
                    branches: Array.from(new Set(branches), name => ({ name }))
                };
            });
            this.items = await Promise.all(tasks);
        }
    },
    created() {
        return this.load();
    }
});
