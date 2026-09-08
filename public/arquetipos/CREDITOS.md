# Fotos de los arquetipos

Cada `<id>.png` es el avatar circular del quiz "¿A qué luchador te parecés?"
(`/que-luchador-sos`), 400x400 con fondo transparente. Se generan con
`scripts/avatar-arquetipo.py`. Si falta el archivo la ficha cae a las
iniciales, asi que nunca se rompe.

## De donde salio cada una

| archivo | luchador | origen | licencia |
|---|---|---|---|
| `marcelo.png` | Marcelo Garcia | [Commons: Marcelo garcia.jpg](https://commons.wikimedia.org/wiki/File:Marcelo_garcia.jpg) | **Dominio publico** |
| `cobrinha.png` | Rubens "Cobrinha" Charles | [Commons: Rubens Cobrinha Charles.jpg](https://commons.wikimedia.org/wiki/File:Rubens_Cobrinha_Charles.jpg) | **CC BY-SA 3.0**, autor Dkaivani |
| `gordon.png` | Gordon Ryan | [BJJ Heroes](https://www.bjjheroes.com/bjj-fighters/gordon-ryan) | sin licencia libre |
| `adam.png` | Adam Wardzinski | [BJJ Heroes](https://www.bjjheroes.com/bjj-fighters/adam-wardzinski) | sin licencia libre |
| `buchecha.png` | Marcus "Buchecha" Almeida | [ONE Championship](https://www.onefc.com/athletes/marcus-almeida/) | sin licencia libre |
| `roger.png` | Roger Gracie | [ONE Championship](https://www.onefc.com/athletes/roger-gracie/) | sin licencia libre |
| `bernardo.png` | Bernardo Faria | [BJJ Fanatics](https://bjjfanatics.com/collections/bernardo-faria) (su propia empresa) | sin licencia libre |

Solo `cobrinha.png` obliga a algo: su licencia pide atribuir al autor. Por eso
el arquetipo tiene cargado el campo `credito` en `src/lib/match-arquetipos.ts`
y la ficha lo muestra al pie. Si se cambia esa foto, sacar el credito.

Las cinco "sin licencia libre" se usan por decision del duenio del negocio,
que es quien asume el riesgo. Esta tabla existe para que, si alguna vez
reclaman por una, se sepa en un minuto cual es y de donde salio, y se pueda
reemplazar sin tocar codigo: alcanza con pisar el PNG.

## Ojo si buscas reemplazos

- **"Buchecha"**: casi todos los resultados en Wikimedia Commons son el
  cantante brasileno, no Marcus Almeida.
- **`gordon.png`**: la version anterior (agosto 2026) NO era Gordon Ryan, era
  un hombre canoso de unos 50 anios. Gordon nacio en 1995. Ya esta corregida.
- **Bernardo** es la unica en blanco y negro. Si molesta al lado de las otras
  seis, hay que conseguir otra: no se puede colorear.

## Como regenerar una

    python scripts/avatar-arquetipo.py <foto.jpg> <id> --x 0.5 --y 0.3 --zoom 1.7

`--x/--y` es donde esta la CARA en proporcion (0.5 = centro) y `--zoom` cuanto
cerrar el encuadre. Conviene hacer una grilla de porcentajes sobre la foto
original antes de estimar, sale mucho mas rapido que a ojo.
