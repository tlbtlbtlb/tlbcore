

$.defPage('doc', function(o) {

  this.html(`
    <div class="tlbcoreDoc"></div>
  `);
  this.children().first().fmtContent('README');

  return this;
});
