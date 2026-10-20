import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default [
  { ignores: ['.next/**', 'next-env.d.ts', 'public/**', 'e2e/**', 'tools/**'] },
  ...nextVitals,
  ...nextTs,
  {
    // Regras do React Compiler (recomendações de arquitetura, não bugs): o código atual funciona; ficam como aviso
    // até serem tratadas tela a tela, para o lint barrar só o que é erro de verdade.
    rules: {
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
]
