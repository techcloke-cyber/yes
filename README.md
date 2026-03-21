# GreatSea Paper Plugin

This repository contains a Paper plugin that generates a mostly-ocean world with scattered islands, inspired by the Great Sea.

## Features
- Custom `ChunkGenerator` that fills the world with deep water and occasional islands.
- Built-in `BiomeProvider` that marks islands as `PLAINS`/`BEACH` and the surrounding water as `WARM_OCEAN`.
- `/greatsea create [world] [seed]` command to create a world using the custom generator.
- `/greatsea tp [world]` command to teleport to an existing Great Sea world.

## Build
```bash
mvn package
```

Drop the generated jar from `target/` into your Paper server's `plugins/` folder.

## Usage
```text
/greatsea create great_sea
/greatsea create great_sea 123456789
/greatsea tp great_sea
```

After creating the world, the command teleports the player to the spawn island or sea surface nearby.
