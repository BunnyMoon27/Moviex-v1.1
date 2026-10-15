const titleKey = (title) => title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase();

export function findInventoryMovie(listing, inventory) {
  const matches = inventory.filter((movie) => movie.year === listing.year && titleKey(movie.title) === titleKey(listing.title));
  return matches.length === 1 ? matches[0] : null;
}
