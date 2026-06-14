CAMBIOS HECHOS:
- Agregar mensajes escritos con sangre en la pared: "Bitcoin o Muerte!", 'CORRÉ!', 'ACÁ NADIE RESPAWNEA BIEN', 'NO ABRAS LA PUERTA ROJA', 'Sin television y sin cerveza...', 'ARCA sabe de tus Bitcoins', 'Halving is coming',(solo 1 de cada 1 distribuidas)
- Hacer que la viiim de la musica suene cada 30 seg, y sostenga de fonod solo el pulso.
- Agregar Arañas que caminen por los techos. quiero un nuevo enemigo, tipo araña que camine por los techos y que dispare al personaje principal. mantene simple el diseño del enemigo ya que sera mejorado luego. pon 3 arañas por nivel excepto el 4, que aparezcan por separado.
- Llevar puntaje via Nostr
- Hay un tubo a veces aparece flotando en medio de la escena, no tiene sentido, busca porque sucede eso y quitalo. es un bug.
- Llevar identidades Nostr: al iniciar el juego debe mostrar un tablero con los puntajes de los jugadores anterioreres (podes usar nostr-scores.html como base para la busqueda en nostr) esto debe seguir la estetica del juego y debe ser un scoreboard simple.

IDEAS:

- Hacer que sea posible multijugador. varios jugadores se pueden conectar y entran al mismo nivel y pueden combatir entre ellos.
- Duelo por sats (cada participante tiene que pagar 10 sat par entrar), el ultimo sobreviviente se lleva todos los sats de los que mato.

NUEVAS IMPLEMENTACIONES:
quiero que implementes estos 4 projectos en 4 branches consecutivas. puedes ir apilando las branches. analiza profundamente como aplicar efectivamente cada proyecto. utiliza los agentes y sub agentes de ohmyopencode. utiliza el oracle para validar que el plan este ok. debes continuar de forma autonoma hasta completar tu mision.
- Pasar todo el codigo posible a typescript. que respete las mejores practicas de programacion. agrega tests a todo lo que sea posible.

- Que para jugar haya que pagar 100 sats, eso crea un fondo que se acumula con cada jugador que paga y pierde. El pozo lo gana el jugador que derrota al boss principal. utiliza el protocolo de zaps para tranferencias lightning, ya que el juego debe no tendra nodo lightning.
