// Verified website directory for the Manlung Recovery safety scanner.
//
// IMPORTANT: This is an explicit trust list, not an automatic claim that
// every website on the internet is legitimate. Add organisations only after
// verifying their official domain from a trustworthy first-party source.
// Subdomains of a verified root domain are treated as official.

module.exports = [
  {
    hostname: 'manlungrecovery.manlungshop.co.ke',
    name: 'Manlung Recovery',
    url: 'https://manlungrecovery.manlungshop.co.ke/',
    description: 'Official Manlung Recovery website',
    aliases: ['manlung', 'manlungrecovery']
  },
  {
    hostname: 'kra.go.ke',
    name: 'Kenya Revenue Authority (KRA)',
    url: 'https://kra.go.ke/',
    description: 'Official Kenya Revenue Authority domain. Verified KRA services may operate on subdomains such as itax.kra.go.ke.',
    aliases: ['kra', 'kenya revenue authority', 'itax']
  },
  {
    hostname: 'ecitizen.go.ke',
    name: 'eCitizen Kenya',
    url: 'https://ecitizen.go.ke/',
    description: 'Official Kenya eCitizen government-services domain.',
    aliases: ['ecitizen', 'e citizen', 'gava']
  }
];
