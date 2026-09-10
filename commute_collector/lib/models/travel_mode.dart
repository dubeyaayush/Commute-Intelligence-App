/// The set of journey-leg modes a volunteer can label.
/// `.name` (e.g. 'walk') is what gets stored; `.label` is shown in the UI.
enum TravelMode {
  walk('Walk'),
  metro('Metro'),
  bus('Bus'),
  auto('Auto'),
  car('Car'),
  bike('Bike'),
  waiting('Waiting'),
  other('Other');

  const TravelMode(this.label);
  final String label;
}