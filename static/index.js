import Vue from 'https://cdnjs.cloudflare.com/ajax/libs/vue/2.5.17/vue.esm.browser.js';
import config from './config';

function git(...args) {
    const res = fetch('/api/git', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-requested-with': fetch.name
        },
        body: JSON.stringify({ args })
    });
    vConsole.input('git ' + args.join(' '));
    res.then(async r => {
        const text = await r.clone().text();
        if (r.status === 200) {
            vConsole.output(text);
        } else {
            vConsole.error(text);
        }
    });
    return res;
}

Vue.component('pt-link', {
    props: ['type', 'value'],
    render(h) {
        if (typeof config.links[this.type] === 'function') {
            const href = config.links[this.type](this.value);
            if (href) {
                return h('a', {
                    attrs: { href, target: '_blank' }
                }, this.value);
            }
        }
        return h('span', this.value);
    }
});

const vConsole = new Vue({
    el: '#console',
    data: {
        collapsed: true,
        lines: []
    },
    methods: {
        add(content, type) {
            this.lines.push({ content, class: `console-line-${type}` });
            Vue.nextTick(() => {
                this.$el.scrollTo(0, this.$el.scrollHeight);
            });
        },
        input(text) {
            this.add('$ ' + text.split('\n').join('\n> '), 'input');
        },
        output(content) { this.add(content, 'output'); },
        error(content) { this.add(content, 'error'); }
    }
});

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
            const tasks = config.branches.map(async branch => {
                const res = {};
                const ltsv = await git(
                    'log',
                    '-1',
                    '--date=iso',
                    '--pretty=format:commitHash:%h\tauthorDate:%ad\tauthorName:%an',
                    branch
                ).then(r => r.text());
                ltsv.split('\t').forEach(e => {
                    const idx = e.indexOf(':');
                    res[e.slice(0, idx)] = e.slice(idx + 1);
                });

                const branchesText = await git(
                    'log',
                    '--first-parent',
                    '--merges',
                    '--pretty=format:%s',
                    `${config.defaultBranch}..${branch}`
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
                    target: branch,
                    commit: res.commitHash,
                    date: res.authorDate,
                    author: res.authorName,
                    branches: Array.from(new Set(branches))
                };
            });
            this.items = await Promise.all(tasks);
        }
    },
    created() {
        return this.load();
    }
});
