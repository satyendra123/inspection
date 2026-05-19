# Inspection React - Free React Tailwind Admin Dashboard Template

#### Preview

- [Demo](https://themewagon.github.io/Inspection/)

#### Download

- [Download from ThemeWagon](https://themewagon.com/themes/Inspection/)

## Getting Started

1. Clone Repository

```
git clone https://github.com/themewagon/Inspection.git
```

2. Install Dependencies

```
npm i
```

3. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

## Automated Testing

1. Install/update dependencies:

```bash
npm install
```

2. Run unit + integration tests (Vitest + Testing Library):

```bash
npm run test
```

3. Watch mode for local development:

```bash
npm run test:watch
```

4. Generate coverage report:

```bash
npm run test:coverage
```

5. Run end-to-end smoke tests (Playwright):

```bash
npm run test:e2e
```

6. Run full pipeline:

```bash
npm run test:all
```

## CI/CD Auto Deploy (GitHub Actions)

`main` branch par push hote hi workflow build karke `dist/` server par deploy karega.

Required GitHub repository secrets:

- `DEPLOY_HOST`: server IP/domain
- `DEPLOY_USER`: SSH user
- `DEPLOY_SSH_KEY`: private key (multi-line)
- `DEPLOY_TARGET_PATH`: server path (example: `/var/www/inspection`)
- `DEPLOY_PORT`: optional, default `22`

Workflow file: `.github/workflows/deploy.yml`

## Author

```
Design and code is completely written by codescandy and development team.
```
scp -P 22 D:\MYproject\TailAdmin-1.0.0\TailAdmin-1.0.0\dist.zip root@150.241.245.209:/var/www/html   

## License

- Design and Code is Copyright &copy; [Inspection](https://Inspection.com)
- Licensed cover under [MIT]
- Distributed by [ThemeWagon](https://themewagon.com)
