package dev.openai.greatsea;

import java.util.List;
import java.util.Random;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.block.Biome;
import org.bukkit.generator.BiomeProvider;
import org.bukkit.generator.ChunkGenerator;
import org.bukkit.generator.WorldInfo;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

public final class GreatSeaGenerator extends ChunkGenerator {
    private static final int SEA_LEVEL = 63;
    private static final int OCEAN_FLOOR_MIN = 20;
    private static final int OCEAN_FLOOR_VARIATION = 10;
    private static final double ISLAND_THRESHOLD = 0.78D;

    private final GreatSeaBiomeProvider biomeProvider = new GreatSeaBiomeProvider();

    @Override
    public boolean shouldGenerateNoise() {
        return false;
    }

    @Override
    public boolean shouldGenerateSurface() {
        return false;
    }

    @Override
    public boolean shouldGenerateCaves() {
        return false;
    }

    @Override
    public boolean shouldGenerateStructures() {
        return false;
    }

    @Override
    public boolean shouldGenerateDecorations() {
        return true;
    }

    @Override
    public boolean shouldGenerateMobs() {
        return true;
    }

    @Override
    public void generateNoise(@NotNull WorldInfo worldInfo,
                              @NotNull Random random,
                              int chunkX,
                              int chunkZ,
                              @NotNull ChunkData chunkData) {
        int minY = chunkData.getMinHeight();
        for (int localX = 0; localX < 16; localX++) {
            for (int localZ = 0; localZ < 16; localZ++) {
                int worldX = (chunkX << 4) + localX;
                int worldZ = (chunkZ << 4) + localZ;

                double islandNoise = normalizedNoise(worldInfo.getSeed(), worldX, worldZ, 0.004D)
                    + 0.55D * normalizedNoise(worldInfo.getSeed() ^ 0x5DEECE66DL, worldX, worldZ, 0.011D);

                boolean island = islandNoise > ISLAND_THRESHOLD;
                int floorHeight = OCEAN_FLOOR_MIN + (int) Math.round(Math.abs(normalizedNoise(worldInfo.getSeed() ^ 0xBL, worldX, worldZ, 0.02D)) * OCEAN_FLOOR_VARIATION);
                int surfaceHeight = island
                    ? SEA_LEVEL + 1 + (int) Math.round((islandNoise - ISLAND_THRESHOLD) * 28.0D)
                    : floorHeight;

                chunkData.setBlock(localX, minY, localZ, Material.BEDROCK);
                for (int y = minY + 1; y < surfaceHeight - 4; y++) {
                    chunkData.setBlock(localX, y, localZ, Material.STONE);
                }

                Material top = island ? Material.GRASS_BLOCK : Material.SAND;
                Material filler = island ? Material.DIRT : Material.SANDSTONE;
                for (int y = Math.max(minY + 1, surfaceHeight - 4); y < surfaceHeight; y++) {
                    chunkData.setBlock(localX, y, localZ, y == surfaceHeight - 1 ? top : filler);
                }

                for (int y = Math.max(surfaceHeight, minY + 1); y <= SEA_LEVEL; y++) {
                    chunkData.setBlock(localX, y, localZ, Material.WATER);
                }
            }
        }
    }

    @Override
    public int getBaseHeight(@NotNull WorldInfo worldInfo, @NotNull Random random, int x, int z, @NotNull HeightMap heightMap) {
        double islandNoise = normalizedNoise(worldInfo.getSeed(), x, z, 0.004D)
            + 0.55D * normalizedNoise(worldInfo.getSeed() ^ 0x5DEECE66DL, x, z, 0.011D);

        if (islandNoise > ISLAND_THRESHOLD) {
            return SEA_LEVEL + 1 + (int) Math.round((islandNoise - ISLAND_THRESHOLD) * 28.0D);
        }

        return OCEAN_FLOOR_MIN + (int) Math.round(Math.abs(normalizedNoise(worldInfo.getSeed() ^ 0xBL, x, z, 0.02D)) * OCEAN_FLOOR_VARIATION);
    }

    @Override
    public @Nullable BiomeProvider getDefaultBiomeProvider(@NotNull WorldInfo worldInfo) {
        return biomeProvider;
    }

    @Override
    public @Nullable Location getFixedSpawnLocation(@NotNull World world, @NotNull Random random) {
        return new Location(world, 0.5D, SEA_LEVEL + 2.0D, 0.5D);
    }

    private double normalizedNoise(long seed, int x, int z, double scale) {
        double nx = x * scale;
        double nz = z * scale;
        double value = Math.sin(nx + seed * 0.0000001D)
            + Math.cos(nz - seed * 0.00000013D)
            + Math.sin((nx + nz) * 0.7D)
            + Math.cos((nx - nz) * 1.2D);
        return value / 4.0D;
    }

    private static final class GreatSeaBiomeProvider extends BiomeProvider {
        @Override
        public @NotNull Biome getBiome(@NotNull WorldInfo worldInfo, int x, int y, int z) {
            double sample = Math.sin(x * 0.003D) + Math.cos(z * 0.003D) + Math.sin((x + z) * 0.0016D);
            if (sample > 2.2D) {
                return Biome.PLAINS;
            }
            if (sample > 1.8D) {
                return Biome.BEACH;
            }
            return Biome.WARM_OCEAN;
        }

        @Override
        public @NotNull List<Biome> getBiomes(@NotNull WorldInfo worldInfo) {
            return List.of(Biome.WARM_OCEAN, Biome.BEACH, Biome.PLAINS);
        }
    }
}
