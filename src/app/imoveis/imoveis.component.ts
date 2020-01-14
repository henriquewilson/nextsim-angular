import {Component, OnInit} from '@angular/core';
import {ImoveisService} from './imoveis.service';
import {Imovel} from './models/imovel.model';
import {ActivatedRoute, Router} from '@angular/router';
import {HttpResponse} from '@angular/common/http';
import * as _ from 'lodash';
import {NgxUiLoaderService} from 'ngx-ui-loader';
import {Options} from 'ng5-slider';
import {GeneralService} from './general.service';
import {CurrencyPipe, formatCurrency} from '@angular/common';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {AngularFireAction, AngularFireDatabase, SnapshotAction} from "@angular/fire/database";
import {AllImoveis} from "../all-imoveis.service";
import {remove as removeAccents} from 'remove-accents';

@Component({
  selector: 'app-imoveis',
  templateUrl: './imoveis.component.html',
  styleUrls: ['./imoveis.component.css']
})
export class ImoveisComponent implements OnInit {

  pages = 0;
  currentPage = 1;

  showExtraFilter = false;

  noResults = false;

  private itensPerPage = 10;


  imoveis: Imovel[] = [];
  allImoveis: Imovel[] = [];

  badges = [];

  queryParams: any;

  mySlideOptions = {items: 1, dots: true, nav: false};
  myCarouselOptions = {items: 3, dots: true, nav: true};


  /// filtro

  customSearch = {
    categoria: 'comprar',
    finalidade: 'residencial',
    quartos: 0,
    salas: 0,
    garagem: 0,
    dormitorios: 0,
    tipos: [],
    precos: {
      min: 0,
      max: 4000000,
    },
    area: {
      min: 0,
      max: 61000,
    },
    bairros: [],
    cidade: ''
  };

  filtred: any[] = [];

  cidades: string[] = [];
  bairrosSelecionados: any[] = [];

  autocompletes: string[] = [];

  options: Options = {
    floor: 0,
    ceil: this.customSearch.precos.max,
    translate: (value: number): string => {
      return formatCurrency(value, 'pt-BR', 'R$', 'BRL');
    }
  };

  optionsArea: Options = {
    floor: 0,
    ceil: this.customSearch.area.max,
    translate: (value: number): string => {
      return value + ' M²';
    }
  };

  removeParams: string[] = [];

  constructor(private route: ActivatedRoute, private ngxService: NgxUiLoaderService, private all: AllImoveis,
              private router: Router, private modalService: NgbModal, private db: AngularFireDatabase) {
  }

  open(content) {
    this.modalService.open(content, {
      ariaLabelledBy: 'modal-basic-title',
      // @ts-ignore
      size: 'xl',
      scrollable: false,
      centered: true,
      windowClass: 'InternalModalFilter'
    }).result.then((result) => {
      this.dropDownChange(false);
    }, (reason) => {

    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(queryParams => {
      this.queryParams = queryParams;
      if (this.queryParams.finalidade) {
        this.customSearch.finalidade = this.queryParams.finalidade;
      }
      this.buildBadges();
      if (!this.all.imoveis) {
        this.ngxService.start();
        this.all.getAll(() => {
          this.getImoveis()
          this.ngxService.stopAll();
          this.ngxService.stop();
        });
      } else {
        this.getImoveis();
      }
      this.loadDefaults();


    });
  }


  categoriaCheckboxChange(categoria: string) {
    this.customSearch.categoria = categoria;
    this.rebuildFilter(false);
  }

  changeFinalidade(event: any, finalidade: string) {
    this.customSearch.finalidade = finalidade;
    this.rebuildFilter(false);
  }


  badgeClose(param: any) {
    console.log(param);

    this.removeParams.push(param);
    this.dropDownChange(false);

  }

  dropDownChange(event: boolean) {

    if (!event) {
      let tipos = [];
      if (!this.removeParams.includes('tipo')) {
        tipos = this.customSearch.tipos.filter(value => {
          return value.selected === true;
        }).map(value => {
          return value.key;
        });
      }
      let bairros;
      if (!this.removeParams.includes('bairros')) {
        bairros = this.customSearch.bairros.filter(value => {
          return value.selected === true;
        }).map(value => {
          return value.key;
        });
      }
      let area: string;
      if (!this.removeParams.includes('bairros')) {
        area = this.customSearch.area.min + ',' + this.customSearch.area.max;
      }
      let precos: string;
      if (!this.removeParams.includes('precos')) {
        precos = this.customSearch.precos.min + ',' + this.customSearch.precos.max;
      }
      this.search({
        finalidade: !this.removeParams.includes('finalidade') ? this.customSearch.finalidade : '',
        tipo: tipos.join(','),
        categoria: !this.removeParams.includes('categoria') ? this.customSearch.categoria : '',
        precos,
        area,
        custom: true,
        dormitorios: !this.removeParams.includes('dormitorios') ? (this.customSearch.dormitorios > 0 ? this.customSearch.dormitorios : '') : '',
        salas: !this.removeParams.includes('salas') ? (this.customSearch.salas > 0 ? this.customSearch.salas : '') : '',
        bairros: bairros.join(','),
        cidade: !this.removeParams.includes('cidade') ? this.customSearch.cidade : ''
      });
    }
  }


  search(query) {
    this.removeParams = [];
    if (query) {
      this.router.navigate(['imoveis'], {
        queryParams: query
      });
    }
  }

  changePage(page: number) {
    this.currentPage = page;
    this.getImoveis();
  }

  private filterAll() {
    console.log(this.imoveis.length);
    console.log(this.allImoveis.length);

    this.imoveis = [];

    this.scrollTop();
    // setTimeout(() => {
    const filtred = this.allImoveis.filter(imovel => {
      const f = [];
      if (this.queryParams.tipo) {
        const tipos = this.queryParams.tipo.split(',');
        if (tipos.includes(imovel.tipo)) {
          f.push('t');
        } else {
          f.push('f');
        }
      }
      if (this.queryParams.finalidade) {
        if (this.queryParams.finalidade === imovel.finalidade) {
          f.push('t');
        } else {
          f.push('f');
        }
      }
      if (this.queryParams.categoria) {
        if (this.queryParams.categoria === 'comprar' && imovel.comercializacao.venda && imovel.comercializacao.venda.ativa) {
          f.push('t');
        } else if (this.queryParams.categoria === 'alugar' && imovel.comercializacao.locacao && imovel.comercializacao.locacao.ativa) {
          f.push('t');
        } else {
          f.push('f');
        }
      }

      if (this.queryParams.bairros) {
        const values = this.queryParams.bairros.split(',');

        if (values.length > 0 && values.includes(imovel.local.bairro)) {
          f.push('t');
        } else {
          f.push('f');
        }

      }

      if (this.queryParams.cidade) {
        if (imovel.local.cidade === this.queryParams.cidade) {
          f.push('t');
        } else {
          f.push('f');
        }
      }

      if (this.queryParams.precos) {
        const values = this.queryParams.precos.split(',');
        if (values.length === 2) {
          // if(values[1] === this.maxPrice) values[1] = 999999999;
          if (imovel.comercializacao.venda && imovel.comercializacao.venda.preco >= values[0] &&
            imovel.comercializacao.venda.preco <= values[1]) {
            f.push('t');
          } else if (imovel.comercializacao.locacao && imovel.comercializacao.locacao.preco >= values[0] &&
            imovel.comercializacao.locacao.preco <= values[1]) {
            f.push('t');
          } else {
            f.push('f');
          }
        } else {
          f.push('f');
        }
      }

      // areas
      // if (this.queryParams.area) {
      //   const values = this.queryParams.area.split(',');
      //   if (values.length === 2) {
      //     if (imovel.numeros && imovel.numeros.areas && imovel.numeros.areas.util >= values[0] && imovel.numeros.areas.util <= values[1]) {
      //       f.push('t');
      //     } else {
      //       f.push('f');
      //     }
      //   } else {
      //     f.push('f');
      //   }
      // }

      // dormitorios
      if (this.queryParams.dormitorios && this.queryParams.dormitorios > 0 && this.queryParams.finalidade === 'residencial') {
        if (imovel.numeros && imovel.numeros.dormitorios && imovel.numeros.dormitorios === Number(this.queryParams.dormitorios)) {
          f.push('t');
        } else {
          f.push('f');
        }
      }

      // salas
      if (this.queryParams.dormitorios && this.queryParams.dormitorios > 0 && this.queryParams.finalidade === 'comercial') {
        if (imovel.numeros && imovel.numeros.salas && imovel.numeros.salas === Number(this.queryParams.salas)) {
          f.push('t');
        } else {
          f.push('f');
        }
      }

      if (this.queryParams.query) {
        if (imovel.sigla.toLocaleUpperCase() === this.queryParams.query.toLocaleUpperCase()) {
          f.push('t');
        } else if (imovel.local && imovel.local.bairro && removeAccents(imovel.local.bairro.toLocaleLowerCase()).search(removeAccents(this.queryParams.query.toLocaleLowerCase())) > -1) {
          f.push('t');
        } else if (imovel.local && imovel.local.cidade && removeAccents(imovel.local.cidade.toLocaleLowerCase()).search(removeAccents(this.queryParams.query.toLocaleLowerCase())) > -1) {
          f.push('t');
        } else {
          f.push('f');
        }
      }

      return !f.includes('f');
    });

    this.pages = filtred.length;
    this.imoveis = _.chunk(filtred, this.itensPerPage)[this.currentPage - 1];

    this.checkResults();
    // }, 2000);


  }

  private getImoveis() {
    this.imoveis = [];
    this.pages = 0;

    this.noResults = false;

    console.log(this.all.imoveis);

    this.allImoveis = this.all.imoveis;
    this.filterAll();
    this.checkResults();
    this.rebuildFilter();
  }


  private checkResults() {
    if (!this.imoveis || this.imoveis.length === 0) {
      this.noResults = true;
    } else {
      this.noResults = false;
    }

  }

  imagensCarousel(images: string[]) {
    return _.slice(images, 0, 3);
  }


  private scrollTop() {
    try {
      window.scrollTo({left: 0, top: 0, behavior: 'smooth'});
    } catch (e) {
      window.scrollTo(0, 0);
    }
  }

  toArea(imovel: Imovel) {
    if (!imovel) {
      return '?';
    }
    try {
      if (imovel && imovel.tipo === 'casa') {
        return imovel.numeros.areas.total.toFixed(0) + ' ' + imovel.numeros.areas.unidade;
      } else if (imovel && imovel.tipo === 'apartamento' || imovel.tipo === 'sala') {
        return imovel.numeros.areas.util.toFixed(0) + ' ' + imovel.numeros.areas.unidade;
      } else if (imovel && imovel.tipo === 'terreno') {
        return imovel.numeros.areas.total.toFixed(0) + ' ' + imovel.numeros.areas.unidade;
      }
    } catch (e) {
      // console.error(e);
    }
    return '?';
  }

  toDormis(imovel: Imovel) {
    if (!imovel) {
      return '?';
    }
    try {
      if (imovel && imovel.finalidade === 'residencial') {
        return imovel.numeros.dormitorios;
      } else if (imovel) {
        return imovel.numeros.salas;
      }
    } catch (e) {
      // console.error(e);
    }
    return '?';
  }

  toSalas(imovel: Imovel) {
    if (!imovel) {
      return '?';
    }
    try {
      if (imovel && imovel.tipo === 'sala') {
        return imovel.numeros.salas;
      } else if (imovel) {
        return imovel.numeros.salas;
      }
    } catch (e) {
      // console.error(e);
    }
    return '?';
  }

  getprice(imovel: Imovel): string {
    if (!imovel) {
      return '?';
    }
    try {
      if (this.queryParams.categoria === 'comprar') {
        if (imovel.comercializacao.venda && imovel.comercializacao.venda.ativa) {
          return this.getFormattedPrice(imovel.comercializacao.venda.preco);
        }
      } else if (this.queryParams.categoria === 'alugar') {
        if (imovel.comercializacao.locacao && imovel.comercializacao.locacao.ativa) {
          return this.getFormattedPrice(imovel.comercializacao.locacao.preco);
        }
      } else {
        if (imovel.comercializacao.locacao && imovel.comercializacao.locacao.ativa) {
          return this.getFormattedPrice(imovel.comercializacao.locacao.preco);
        } else if (imovel.comercializacao.venda && imovel.comercializacao.venda.ativa) {
          return this.getFormattedPrice(imovel.comercializacao.venda.preco);
        }
      }
    } catch (e) {
      // console.error(e);
    }
    return '?';
  }

  getFormattedPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(price).replace(',00', '');
  }

  buildBadges() {
    // area: "0,61000"
    // bairros: ""
    // categoria: "comprar"
    // cidade: ""
    // custom: "true"
    // dormitorios: "0"
    // finalidade: "residencial"
    // precos: "0,39000000"
    // salas: "0"
    // tipo: ""
    this.badges = [];
    if (this.queryParams.categoria) {
      this.badges.push(this.badge(this.queryParams.categoria, 'categoria'));
    }

    if (this.queryParams.finalidade) {
      this.badges.push(this.badge(this.queryParams.finalidade, 'finalidade'));
    }

    if (this.queryParams.bairros) {
      const ss = this.queryParams.bairros.split(',');
      if (ss.length > 1) {
        this.badges.push(this.badge(`Nos bairros: ${ss.join(', ')}`, 'bairros'));
      } else {
        this.badges.push(this.badge(`No bairro: ${ss.join(', ')}`, 'bairros'));
      }
    }

    if (this.queryParams.cidade) {
      this.badges.push(this.badge(`Na cidade de ${this.queryParams.cidade}`, 'cidade'));
    }

    if (this.queryParams.dormitorios) {
      const n = Number(this.queryParams.dormitorios);
      if (n === 1) {
        this.badges.push(this.badge(`Com ${n} dormitório`, 'dormitorios'));
      } else if (n === 4) {
        this.badges.push(this.badge(`Com ${n} ou mais dormitórios`, 'dormitorios'));
      } else if (n !== 0) {
        this.badges.push(this.badge(`Com ${n}  dormitórios`, 'dormitorios'));
      }

    }

    if (this.queryParams.tipo) {
      const ss = this.queryParams.tipo.split(',');
      if (ss.length > 1) {
        this.badges.push(this.badge(`Tipos: ${ss.join(', ')}`, 'tipo'));
      } else {
        this.badges.push(this.badge(`Tipo: ${ss.join(', ')}`, 'tipo'));
      }
    }

    if (this.queryParams.precos) {
      const ss = this.queryParams.precos.split(',');


      const pMin = Number(ss[0]);
      const pMax = Number(ss[1]);

      // if (pMin !== this.minPrice || pMax !== this.maxPrice) {
      if (pMin !== 0 || pMax !== 4000000) {
        const spMin = formatCurrency(Number(ss[0]), 'pt-BR', 'R$', 'BRL');
        const spMax = formatCurrency(Number(ss[1]), 'pt-BR', 'R$', 'BRL');
        this.badges.push(this.badge(`Entre: ${spMin} e ${spMax}`, 'precos'));
      }
    }
  }

  private badge(s: string, query: string): any {
    return {label: s, query};

  }

  // fitros metodes


  changeCidade(cidade: string) {
    this.customSearch.cidade = cidade;
    this.buildLocaisBairros(cidade);
  }

  changeTipo(event: any, i: number) {
    this.customSearch.tipos[i].selected = event.currentTarget.checked;
    console.log(this.customSearch.tipos);
  }

  changeBairro(event: any, i: number) {
    console.log('changeBairro');
    this.customSearch.bairros[i].selected = event.currentTarget.checked;
    this.bairrosSelecionados = this.customSearch.bairros.filter(value => {
      return value.selected === true;
    }).map(value => {
      return value.key;
    });
  }


  private loadDefaults() {

    this.db.list('area').snapshotChanges().subscribe((action: SnapshotAction<{}>[]) => {
      action.forEach(value => {
        if (value.key === 'min') {
          this.customSearch.area.min = value.payload.val() as number;

        } else if (value.key === 'max') {
          this.customSearch.area.max = value.payload.val() as number;

        }
      })
    });

    this.db.list('precos').snapshotChanges().subscribe((action: SnapshotAction<{}>[]) => {
      action.forEach(value => {
        if (value.key === 'min') {
          this.customSearch.precos.min = value.payload.val() as number;
        } else if (value.key === 'max') {
          this.customSearch.precos.max = value.payload.val() as number;
        }
      });
    });
  }


  buildLocaisBairros(cidade: string) {
    this.customSearch.bairros = [];
    _.union(_.compact(_.map(this.filtred, (im: Imovel, key) => {
      if (_.get(im, "local.cidade") === cidade) {
        return im.local.bairro;
      }
      return null;
    }))).forEach((value, index) => {
      this.customSearch.bairros.push({key: value, selected: false, i: index, c: cidade});
    });

    console.log(this.customSearch.bairros);
  }


  rebuildFilter(event?: any) {

    if (!this.all.imoveis) return;

    this.filtred = this.all.imoveis.filter((imovel: Imovel) => {
      let add = false;
      if (this.customSearch.categoria === 'comprar' && _.get(imovel, "comercializacao.venda.ativa")) {
        add = true;
      }
      if (this.customSearch.categoria === 'alugar' && _.get(imovel, "comercializacao.locacao.ativa")) {
        add = true;
      }

      if (!add) return add;

      if (this.customSearch.finalidade === 'residencial' && imovel.finalidade !== 'residencial') {
        add = false;
      }
      if (this.customSearch.finalidade === 'comercial' && imovel.finalidade !== 'comercial') {
        add = false;
      }

      return add;
    });


    this.customSearch.tipos = [];
    this.cidades = [];

    this.filtred.forEach((im: Imovel, i: number) => {
      this.cidades.push(im.local.cidade);
      if (i === 0) {
        this.buildLocaisBairros(im.local.cidade);
      }
    });


    _.union(_.compact(_.map(this.filtred, (im: Imovel, key) => {
      return im.tipo;
    }))).forEach((value, index) => {
      this.customSearch.tipos.push({key: value, selected: false, i: index});
    });

    this.cidades = _.union(this.cidades)
    console.log(this.cidades);
    console.log(this.filtred);
  }


}
